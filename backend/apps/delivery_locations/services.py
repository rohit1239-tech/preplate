import logging
import math
import re
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.delivery_locations.models import DeliveryLocation, LocationRequest, RestaurantDeliveryLocation
from apps.restaurants.models import Restaurant

logger = logging.getLogger(__name__)
DUPLICATE_RADIUS_METERS = 50


def normalize_location_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def haversine_distance_meters(lat1: Decimal, lon1: Decimal, lat2: Decimal, lon2: Decimal) -> float:
    radius = 6_371_000
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2 - lat1))
    delta_lambda = math.radians(float(lon2 - lon1))
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class LocationDuplicateService:
    @classmethod
    def find_duplicate(cls, name: str, address: str, latitude: Decimal | None, longitude: Decimal | None) -> dict | None:
        if latitude is not None and longitude is not None:
            location_match = cls._nearby_location(latitude, longitude)
            if location_match:
                return {"type": "location", "object": location_match}
            request_match = cls._nearby_request(latitude, longitude)
            if request_match:
                return {"type": "request", "object": request_match}

        normalized_name = normalize_location_text(name)
        normalized_address = normalize_location_text(address)
        for location in DeliveryLocation.objects.filter(is_active=True):
            if normalize_location_text(location.name) == normalized_name and normalize_location_text(location.address) == normalized_address:
                return {"type": "location", "object": location}
        for request in LocationRequest.objects.filter(status=LocationRequest.Status.PENDING):
            if normalize_location_text(request.name) == normalized_name and normalize_location_text(request.address) == normalized_address:
                return {"type": "request", "object": request}
        return None

    @staticmethod
    def _nearby_location(latitude: Decimal, longitude: Decimal) -> DeliveryLocation | None:
        for location in DeliveryLocation.objects.filter(is_active=True).exclude(latitude__isnull=True).exclude(longitude__isnull=True):
            if haversine_distance_meters(latitude, longitude, location.latitude, location.longitude) <= DUPLICATE_RADIUS_METERS:
                return location
        return None

    @staticmethod
    def _nearby_request(latitude: Decimal, longitude: Decimal) -> LocationRequest | None:
        for request in LocationRequest.objects.filter(status=LocationRequest.Status.PENDING).exclude(latitude__isnull=True).exclude(longitude__isnull=True):
            if haversine_distance_meters(latitude, longitude, request.latitude, request.longitude) <= DUPLICATE_RADIUS_METERS:
                return request
        return None


class LocationRequestService:
    @classmethod
    @transaction.atomic
    def create_request(cls, *, requester, restaurant, name: str, address: str, latitude=None, longitude=None, note: str = "") -> LocationRequest:
        duplicate = LocationDuplicateService.find_duplicate(name, address, latitude, longitude)
        if duplicate:
            matched = duplicate["object"]
            logger.info(
                "location_request_duplicate_rejected",
                extra={
                    "requester_id": str(requester.id),
                    "matched_type": duplicate["type"],
                    "matched_id": str(matched.id),
                    "latitude": str(latitude) if latitude is not None else None,
                    "longitude": str(longitude) if longitude is not None else None,
                },
            )
            raise ValidationError({"detail": f"A matching location request already exists near {matched.name}."})

        request = LocationRequest.objects.create(
            requester=requester,
            restaurant=restaurant,
            name=name,
            address=address,
            latitude=latitude,
            longitude=longitude,
            note=note,
        )
        logger.info(
            "location_request_created",
            extra={
                "location_request_id": str(request.id),
                "requester_id": str(requester.id),
                "restaurant_id": str(restaurant.id) if restaurant else None,
                "has_coordinates": latitude is not None and longitude is not None,
            },
        )
        return request

    @classmethod
    @transaction.atomic
    def approve(cls, *, request: LocationRequest, reviewer) -> LocationRequest:
        if request.status != LocationRequest.Status.PENDING:
            raise ValidationError("Only pending location requests can be approved.")
        location = request.matched_location
        if location is None:
            location, _ = DeliveryLocation.objects.get_or_create(
                name=request.name.strip(),
                address=request.address.strip(),
                defaults={
                    "latitude": request.latitude,
                    "longitude": request.longitude,
                    "is_active": True,
                },
            )

        request.status = LocationRequest.Status.APPROVED
        request.reviewed_by = reviewer
        request.reviewed_at = timezone.now()
        request.created_location = location
        request.save(update_fields=["status", "reviewed_by", "reviewed_at", "created_location", "updated_at"])

        if request.restaurant_id:
            RestaurantDeliveryLocation.objects.get_or_create(
                restaurant=request.restaurant,
                delivery_location=location,
                defaults={"capacity_per_slot": 50, "is_active": True},
            )

        logger.info(
            "location_request_approved",
            extra={
                "location_request_id": str(request.id),
                "delivery_location_id": str(location.id),
                "actor_id": str(reviewer.id),
                "restaurant_id": str(request.restaurant_id) if request.restaurant_id else None,
            },
        )
        return request

    @classmethod
    @transaction.atomic
    def reject(cls, *, request: LocationRequest, reviewer) -> LocationRequest:
        if request.status != LocationRequest.Status.PENDING:
            raise ValidationError("Only pending location requests can be rejected.")
        request.status = LocationRequest.Status.REJECTED
        request.reviewed_by = reviewer
        request.reviewed_at = timezone.now()
        request.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        logger.info(
            "location_request_rejected",
            extra={"location_request_id": str(request.id), "actor_id": str(reviewer.id)},
        )
        return request


def validate_restaurant_operational(restaurant: Restaurant, user) -> None:
    if user.role == "RESTAURANT_ADMIN" and restaurant.owner_id != user.id:
        raise ValidationError("You can only manage your own restaurant.")
    if restaurant.status != Restaurant.Status.APPROVED:
        raise ValidationError("Your restaurant must be approved before this can be managed.")
