from rest_framework import serializers

from apps.delivery_locations.models import DeliveryLocation


class DeliveryLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryLocation
        fields = ("id", "restaurant", "name", "address", "capacity_per_slot", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_restaurant(self, restaurant):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN":
            if restaurant.owner_id != request.user.id:
                raise serializers.ValidationError("You can only manage your own restaurant.")
        return restaurant
