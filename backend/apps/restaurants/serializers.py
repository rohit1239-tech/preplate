from rest_framework import serializers

from apps.restaurants.models import Restaurant


class RestaurantSerializer(serializers.ModelSerializer):
    owner_email = serializers.SerializerMethodField()
    owner_first_name = serializers.SerializerMethodField()
    owner_last_name = serializers.SerializerMethodField()
    owner_phone = serializers.SerializerMethodField()

    def can_view_owner_details(self, restaurant: Restaurant) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return user.role == "PLATFORM_ADMIN" or restaurant.owner_id == user.id

    def get_owner_email(self, restaurant: Restaurant) -> str | None:
        if not self.can_view_owner_details(restaurant):
            return None
        return restaurant.owner.email

    def get_owner_first_name(self, restaurant: Restaurant) -> str | None:
        if not self.can_view_owner_details(restaurant):
            return None
        return restaurant.owner.first_name

    def get_owner_last_name(self, restaurant: Restaurant) -> str | None:
        if not self.can_view_owner_details(restaurant):
            return None
        return restaurant.owner.last_name

    def get_owner_phone(self, restaurant: Restaurant) -> str | None:
        if not self.can_view_owner_details(restaurant):
            return None
        return restaurant.owner.phone

    class Meta:
        model = Restaurant
        fields = (
            "id",
            "owner",
            "owner_email",
            "owner_first_name",
            "owner_last_name",
            "owner_phone",
            "name",
            "description",
            "image",
            "phone",
            "status",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner",
            "owner_email",
            "owner_first_name",
            "owner_last_name",
            "owner_phone",
            "status",
            "created_at",
            "updated_at",
        )
