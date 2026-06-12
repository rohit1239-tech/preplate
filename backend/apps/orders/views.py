from rest_framework import decorators, permissions, response, viewsets

from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer, OrderStatusUpdateSerializer, VerifyPINSerializer
from apps.orders.services import OrderStateMachine


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Order.objects.select_related("customer", "restaurant", "delivery_location", "slot").prefetch_related("items")
        user = self.request.user
        if user.role == "PLATFORM_ADMIN":
            return qs
        if user.role == "RESTAURANT_ADMIN":
            return qs.filter(restaurant__owner=user)
        return qs.filter(customer=user)

    @decorators.action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = OrderStateMachine.transition(
            order,
            serializer.validated_data["status"],
            request.user,
            serializer.validated_data.get("note", ""),
        )
        return response.Response(self.get_serializer(order).data)

    @decorators.action(detail=True, methods=["post"], url_path="verify-pin")
    def verify_pin(self, request, pk=None):
        order = self.get_object()
        serializer = VerifyPINSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = OrderStateMachine.verify_pin(order, serializer.validated_data["pin"], request.user)
        return response.Response({"verified": True, "order": self.get_serializer(order).data})
