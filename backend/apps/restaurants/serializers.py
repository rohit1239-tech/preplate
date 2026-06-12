from rest_framework import serializers

from apps.restaurants.models import Restaurant


class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = ("id", "owner", "name", "description", "phone", "status", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "owner", "status", "created_at", "updated_at")
