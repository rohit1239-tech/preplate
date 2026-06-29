from django.utils import timezone
from rest_framework import serializers

from apps.cart.models import Cart, CartItem
from apps.menus.models import MenuItem
from apps.payments.models import Payment


class CartItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = CartItem
        fields = (
            "id",
            "menu_item",
            "quantity",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        )


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = (
            "id",
            "customer",
            "restaurant",
            "delivery_location",
            "slot",
            "delivery_date",
            "status",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "customer",
            "status",
            "items",
            "created_at",
            "updated_at",
        )


class CartInitializeSerializer(serializers.Serializer):
    restaurant_id = serializers.UUIDField()
    delivery_location_id = serializers.UUIDField()
    slot_id = serializers.UUIDField()
    delivery_date = serializers.DateField()

    def validate_delivery_date(self, delivery_date):
        if delivery_date != timezone.localdate():
            raise serializers.ValidationError("Delivery date must be today.")
        return delivery_date


class CartAddItemSerializer(serializers.Serializer):
    menu_item_id = serializers.PrimaryKeyRelatedField(
        queryset=MenuItem.objects.all(), source="menu_item"
    )
    quantity = serializers.IntegerField(min_value=1)


class CheckoutSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=Payment.Method.choices)
