from rest_framework import serializers

from apps.orders.models import Order, OrderItem, OrderStatusHistory


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ("id", "menu_item", "name", "quantity", "unit_price", "line_total")


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ("id", "from_status", "to_status", "changed_by", "note", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer",
            "restaurant",
            "delivery_location",
            "slot",
            "delivery_date",
            "status",
            "delivery_pin",
            "delivery_pin_attempts",
            "subtotal",
            "discount_amount",
            "delivery_fee",
            "total",
            "payment_status",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if (
            attrs["status"] == Order.Status.CANCELLED
            and not attrs.get("note", "").strip()
        ):
            raise serializers.ValidationError(
                {"note": "Cancellation reason is required."}
            )
        return attrs


class VerifyPINSerializer(serializers.Serializer):
    pin = serializers.CharField(min_length=4, max_length=4)
