from rest_framework import serializers

from apps.slots.models import DeliverySlot


class DeliverySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverySlot
        fields = (
            "id",
            "restaurant",
            "name",
            "cutoff_time",
            "delivery_start_time",
            "delivery_end_time",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, name):
        normalized = name.strip().title()
        if normalized not in {"Lunch", "Dinner"}:
            raise serializers.ValidationError("MVP slots are limited to Lunch and Dinner.")
        return normalized

    def validate_restaurant(self, restaurant):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN":
            if restaurant.owner_id != request.user.id:
                raise serializers.ValidationError("You can only manage your own restaurant.")
        return restaurant

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("delivery_start_time") or getattr(self.instance, "delivery_start_time", None)
        end = attrs.get("delivery_end_time") or getattr(self.instance, "delivery_end_time", None)
        cutoff = attrs.get("cutoff_time") or getattr(self.instance, "cutoff_time", None)
        if start and end and start >= end:
            raise serializers.ValidationError({"delivery_end_time": "Delivery end must be after start."})
        if cutoff and start and cutoff >= start:
            raise serializers.ValidationError({"cutoff_time": "Cutoff must be before delivery start."})
        return attrs
