from rest_framework import serializers

from apps.menus.models import MenuCategory, MenuItem


class RestaurantOwnershipMixin:
    def validate_restaurant(self, restaurant):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN":
            if restaurant.owner_id != request.user.id:
                raise serializers.ValidationError("You can only manage your own restaurant.")
        return restaurant


class MenuCategorySerializer(RestaurantOwnershipMixin, serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = ("id", "restaurant", "name", "display_order", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class MenuItemSerializer(RestaurantOwnershipMixin, serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = (
            "id",
            "restaurant",
            "category",
            "name",
            "description",
            "price",
            "image",
            "is_available",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        restaurant = attrs.get("restaurant") or getattr(self.instance, "restaurant", None)
        category = attrs.get("category") or getattr(self.instance, "category", None)
        if restaurant and category and category.restaurant_id != restaurant.id:
            raise serializers.ValidationError({"category": "Category must belong to the selected restaurant."})
        return attrs
