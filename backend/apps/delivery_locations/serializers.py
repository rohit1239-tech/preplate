from rest_framework import serializers

from apps.delivery_locations.models import DeliveryLocation, LocationRequest, RestaurantDeliveryLocation
from apps.delivery_locations.services import LocationRequestService, validate_restaurant_operational
from apps.restaurants.models import Restaurant


class DeliveryLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryLocation
        fields = ("id", "name", "address", "latitude", "longitude", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class RestaurantDeliveryLocationSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source="delivery_location.name", read_only=True)
    location_address = serializers.CharField(source="delivery_location.address", read_only=True)
    location_latitude = serializers.DecimalField(source="delivery_location.latitude", max_digits=9, decimal_places=6, read_only=True)
    location_longitude = serializers.DecimalField(source="delivery_location.longitude", max_digits=9, decimal_places=6, read_only=True)

    class Meta:
        model = RestaurantDeliveryLocation
        fields = (
            "id",
            "restaurant",
            "delivery_location",
            "location_name",
            "location_address",
            "location_latitude",
            "location_longitude",
            "capacity_per_slot",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "location_name", "location_address", "location_latitude", "location_longitude", "created_at", "updated_at")

    def validate_restaurant(self, restaurant):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN":
            validate_restaurant_operational(restaurant, request.user)
        return restaurant

    def validate_delivery_location(self, location):
        if not location.is_active:
            raise serializers.ValidationError("Delivery location is not active.")
        return location


class LocationRequestSerializer(serializers.ModelSerializer):
    requester_email = serializers.EmailField(source="requester.email", read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True)
    matched_location_name = serializers.CharField(source="matched_location.name", read_only=True)
    matched_request_name = serializers.CharField(source="matched_request.name", read_only=True)
    created_location_name = serializers.CharField(source="created_location.name", read_only=True)

    class Meta:
        model = LocationRequest
        fields = (
            "id",
            "requester",
            "requester_email",
            "restaurant",
            "restaurant_name",
            "name",
            "address",
            "latitude",
            "longitude",
            "note",
            "status",
            "matched_location",
            "matched_location_name",
            "matched_request",
            "matched_request_name",
            "created_location",
            "created_location_name",
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "requester",
            "requester_email",
            "status",
            "matched_location",
            "matched_location_name",
            "matched_request",
            "matched_request_name",
            "created_location",
            "created_location_name",
            "reviewed_by",
            "reviewed_at",
            "created_at",
            "updated_at",
        )

    def validate_restaurant(self, restaurant: Restaurant | None):
        request = self.context.get("request")
        if restaurant is None or not request or not request.user.is_authenticated:
            return restaurant
        if request.user.role == "CUSTOMER":
            raise serializers.ValidationError("Customers cannot attach requests to a restaurant.")
        if request.user.role == "RESTAURANT_ADMIN":
            validate_restaurant_operational(restaurant, request.user)
        return restaurant

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN" and attrs.get("restaurant") is None:
            raise serializers.ValidationError({"restaurant": "Restaurant admins must attach requests to their approved restaurant."})
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError("Latitude and longitude must be provided together.")
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        validated_data.setdefault("restaurant", None)
        validated_data.setdefault("note", "")
        return LocationRequestService.create_request(requester=request.user, **validated_data)
