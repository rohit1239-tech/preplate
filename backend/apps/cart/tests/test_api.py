import uuid
from datetime import time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.cart.models import Cart
from apps.cart.services import CartService
from apps.delivery_locations.models import DeliveryLocation, RestaurantDeliveryLocation
from apps.menus.models import MenuCategory, MenuItem
from apps.restaurants.models import Restaurant
from apps.slots.models import DeliverySlot


class CartCheckoutAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email="checkout-customer@preplate.local",
            phone="9000010001",
            role=User.Role.CUSTOMER,
        )
        self.other_customer = User.objects.create_user(
            email="checkout-other@preplate.local",
            phone="9000010002",
            role=User.Role.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            email="checkout-owner@preplate.local",
            phone="9000010003",
            role=User.Role.RESTAURANT_ADMIN,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Checkout Kitchen",
            phone="9000010004",
            status=Restaurant.Status.APPROVED,
        )
        self.location = DeliveryLocation.objects.create(
            name="Main Gate", address="Main campus gate"
        )
        RestaurantDeliveryLocation.objects.create(
            restaurant=self.restaurant,
            delivery_location=self.location,
            capacity_per_slot=10,
        )
        self.slot = DeliverySlot.objects.create(
            restaurant=self.restaurant,
            name="Lunch",
            cutoff_time=time(23, 59),
            delivery_start_time=time(12, 0),
            delivery_end_time=time(13, 0),
        )
        self.category = MenuCategory.objects.create(
            restaurant=self.restaurant, name="Meals"
        )
        self.item = MenuItem.objects.create(
            restaurant=self.restaurant,
            category=self.category,
            name="Chicken 65",
            price=Decimal("150.00"),
        )

    def _active_cart(self) -> Cart:
        cart = CartService.initialize_cart(
            self.customer,
            self.restaurant,
            self.location,
            self.slot,
            timezone.localdate(),
        )
        CartService.add_item(cart, self.item, 1)
        return cart

    def test_checkout_requires_authentication(self) -> None:
        cart_id = uuid.uuid4()

        response = self.client.post(
            f"/api/v1/cart/{cart_id}/checkout/",
            {"payment_method": "COD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_checkout_requires_customer_role(self) -> None:
        cart = self._active_cart()
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            f"/api/v1/cart/{cart.id}/checkout/",
            {"payment_method": "COD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_initialize_cart_rejects_future_delivery_date(self) -> None:
        self.client.force_authenticate(user=self.customer)

        response = self.client.post(
            "/api/v1/cart/",
            {
                "restaurant_id": str(self.restaurant.id),
                "delivery_location_id": str(self.location.id),
                "slot_id": str(self.slot.id),
                "delivery_date": str(timezone.localdate() + timedelta(days=1)),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_cannot_access_another_customers_cart(self) -> None:
        cart = self._active_cart()
        self.client.force_authenticate(user=self.other_customer)

        response = self.client.post(
            f"/api/v1/cart/{cart.id}/checkout/",
            {"payment_method": "COD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
