from rest_framework import decorators, permissions, response, status, viewsets

from apps.cart.models import Cart
from apps.cart.serializers import (
    CartAddItemSerializer,
    CartInitializeSerializer,
    CartSerializer,
    CheckoutSerializer,
)
from apps.cart.services import CartService
from apps.delivery_locations.models import DeliveryLocation
from apps.orders.serializers import OrderSerializer
from apps.restaurants.models import Restaurant
from apps.slots.models import DeliverySlot
from core.permissions.classes import IsCustomer


class CartViewSet(viewsets.GenericViewSet):
    serializer_class = CartSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Cart.objects.filter(customer=self.request.user).select_related(
            "restaurant", "delivery_location", "slot"
        )

    def list(self, request):
        cart = self.get_queryset().filter(status=Cart.Status.ACTIVE).first()
        return response.Response(self.get_serializer(cart).data if cart else None)

    def create(self, request):
        serializer = CartInitializeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = CartService.initialize_cart(
            customer=request.user,
            restaurant=Restaurant.objects.get(
                pk=serializer.validated_data["restaurant_id"]
            ),
            delivery_location=DeliveryLocation.objects.get(
                pk=serializer.validated_data["delivery_location_id"]
            ),
            slot=DeliverySlot.objects.get(pk=serializer.validated_data["slot_id"]),
            delivery_date=serializer.validated_data["delivery_date"],
        )
        return response.Response(
            self.get_serializer(cart).data, status=status.HTTP_201_CREATED
        )

    @decorators.action(detail=True, methods=["post"], url_path="items")
    def add_item(self, request, pk=None):
        cart = self.get_object()
        serializer = CartAddItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        CartService.add_item(
            cart,
            serializer.validated_data["menu_item"],
            serializer.validated_data["quantity"],
        )
        return response.Response(self.get_serializer(cart).data)

    @decorators.action(detail=True, methods=["post"])
    def checkout(self, request, pk=None):
        cart = self.get_object()
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = CartService.checkout(
            cart, serializer.validated_data["payment_method"], request.user
        )
        return response.Response(
            OrderSerializer(order).data, status=status.HTTP_201_CREATED
        )
