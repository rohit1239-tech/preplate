import logging

from rest_framework import decorators, permissions, response, viewsets
from rest_framework.exceptions import PermissionDenied

from core.permissions.classes import ReadOnlyOrRestaurantOwnerOrPlatformAdmin

from apps.delivery_locations.models import DeliveryLocation, LocationRequest, RestaurantDeliveryLocation
from apps.delivery_locations.serializers import (
    DeliveryLocationSerializer,
    LocationRequestSerializer,
    RestaurantDeliveryLocationSerializer,
)
from apps.delivery_locations.services import LocationRequestService

logger = logging.getLogger(__name__)


class DeliveryLocationViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryLocationSerializer
    permission_classes = [ReadOnlyOrRestaurantOwnerOrPlatformAdmin]

    def get_queryset(self):
        qs = DeliveryLocation.objects.all()
        if self.request.user.is_authenticated and self.request.user.role == "PLATFORM_ADMIN":
            return qs
        return qs.filter(is_active=True)

    def perform_create(self, serializer):
        if self.request.user.role != "PLATFORM_ADMIN":
            raise PermissionDenied("Only platform admins can create delivery locations.")
        location = serializer.save()
        logger.info(
            "delivery_location_created",
            extra={
                "delivery_location_id": str(location.id),
                "actor_id": str(self.request.user.id),
                "is_active": location.is_active,
                "has_coordinates": location.latitude is not None and location.longitude is not None,
            },
        )

    def perform_update(self, serializer):
        if self.request.user.role != "PLATFORM_ADMIN":
            raise PermissionDenied("Only platform admins can update delivery locations.")
        location = serializer.save()
        logger.info(
            "delivery_location_updated",
            extra={
                "delivery_location_id": str(location.id),
                "actor_id": str(self.request.user.id),
                "is_active": location.is_active,
                "has_coordinates": location.latitude is not None and location.longitude is not None,
            },
        )


class RestaurantDeliveryLocationViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantDeliveryLocationSerializer
    permission_classes = [ReadOnlyOrRestaurantOwnerOrPlatformAdmin]

    def get_queryset(self):
        qs = RestaurantDeliveryLocation.objects.select_related("restaurant", "delivery_location")
        restaurant_id = self.request.query_params.get("restaurant")
        location_id = self.request.query_params.get("delivery_location")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        if location_id:
            qs = qs.filter(delivery_location_id=location_id)
        if not self.request.user.is_authenticated or self.request.user.role == "CUSTOMER":
            return qs.filter(is_active=True, restaurant__status="APPROVED", restaurant__is_active=True, delivery_location__is_active=True)
        if self.request.user.role == "RESTAURANT_ADMIN":
            return qs.filter(restaurant__owner=self.request.user, restaurant__status="APPROVED")
        return qs

    def perform_create(self, serializer):
        service = serializer.save()
        logger.info(
            "restaurant_delivery_location_created",
            extra={
                "restaurant_delivery_location_id": str(service.id),
                "restaurant_id": str(service.restaurant_id),
                "delivery_location_id": str(service.delivery_location_id),
                "actor_id": str(self.request.user.id),
                "capacity_per_slot": service.capacity_per_slot,
                "is_active": service.is_active,
            },
        )

    def perform_update(self, serializer):
        service = serializer.save()
        logger.info(
            "restaurant_delivery_location_updated",
            extra={
                "restaurant_delivery_location_id": str(service.id),
                "restaurant_id": str(service.restaurant_id),
                "delivery_location_id": str(service.delivery_location_id),
                "actor_id": str(self.request.user.id),
                "capacity_per_slot": service.capacity_per_slot,
                "is_active": service.is_active,
            },
        )


class LocationRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LocationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = LocationRequest.objects.select_related(
            "requester",
            "restaurant",
            "matched_location",
            "matched_request",
            "created_location",
            "reviewed_by",
        )
        if self.request.user.role == "PLATFORM_ADMIN":
            status = self.request.query_params.get("status")
            if status:
                qs = qs.filter(status=status)
            return qs
        return qs.filter(requester=self.request.user)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        location_request = LocationRequestService.approve(request=self.get_object(), reviewer=request.user)
        return response.Response(self.get_serializer(location_request).data)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        location_request = LocationRequestService.reject(request=self.get_object(), reviewer=request.user)
        return response.Response(self.get_serializer(location_request).data)
