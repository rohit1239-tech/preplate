from datetime import date, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.cart.models import Cart
from apps.cart.services import CartService
from apps.delivery_locations.models import DeliveryLocation
from apps.menus.models import MenuCategory, MenuItem
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.restaurants.models import Restaurant
from apps.slots.models import DeliverySlot


class CartServiceTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(email="user9000000001@preplate.local", phone="9000000001", role=User.Role.CUSTOMER)
        self.owner = User.objects.create_user(email="user9000000002@preplate.local", phone="9000000002", role=User.Role.RESTAURANT_ADMIN)
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Kitchen",
            phone="9000000003",
            status=Restaurant.Status.APPROVED,
        )
        self.location = DeliveryLocation.objects.create(
            restaurant=self.restaurant,
            name="Gate",
            address="Main gate",
            capacity_per_slot=1,
        )
        self.slot = DeliverySlot.objects.create(
            restaurant=self.restaurant,
            name="Lunch",
            cutoff_time=time(23, 59),
            delivery_start_time=time(12, 0),
            delivery_end_time=time(13, 0),
        )
        self.category = MenuCategory.objects.create(restaurant=self.restaurant, name="Meals")
        self.item = MenuItem.objects.create(
            restaurant=self.restaurant,
            category=self.category,
            name="Thali",
            price=Decimal("120.00"),
        )

    def test_checkout_creates_order_from_cart_with_snapshotted_price(self):
        cart = CartService.initialize_cart(
            self.customer,
            self.restaurant,
            self.location,
            self.slot,
            timezone.localdate() + timedelta(days=1),
        )
        CartService.add_item(cart, self.item, 2)

        self.item.price = Decimal("150.00")
        self.item.save(update_fields=["price"])

        order = CartService.checkout(cart, Payment.Method.COD, self.customer)

        self.assertEqual(order.status, Order.Status.PLACED)
        self.assertEqual(order.subtotal, Decimal("240.00"))
        self.assertEqual(order.total, Decimal("240.00"))
        self.assertEqual(order.items.get().unit_price, Decimal("120.00"))
        self.assertEqual(Cart.objects.get(pk=cart.pk).status, Cart.Status.CHECKED_OUT)
        self.assertEqual(order.payment.method, Payment.Method.COD)

    def test_capacity_is_enforced_at_checkout(self):
        first_cart = CartService.initialize_cart(
            self.customer,
            self.restaurant,
            self.location,
            self.slot,
            timezone.localdate() + timedelta(days=1),
        )
        CartService.add_item(first_cart, self.item, 1)
        CartService.checkout(first_cart, Payment.Method.COD, self.customer)

        second_customer = User.objects.create_user(email="user9000000004@preplate.local", phone="9000000004", role=User.Role.CUSTOMER)
        second_cart = CartService.initialize_cart(
            second_customer,
            self.restaurant,
            self.location,
            self.slot,
            timezone.localdate() + timedelta(days=1),
        )
        CartService.add_item(second_cart, self.item, 1)

        with self.assertRaises(ValidationError):
            CartService.checkout(second_cart, Payment.Method.COD, second_customer)

    def test_past_delivery_date_is_rejected(self):
        cart = Cart.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            delivery_location=self.location,
            slot=self.slot,
            delivery_date=date.today() - timedelta(days=1),
        )
        CartService.add_item(cart, self.item, 1)

        with self.assertRaises(ValidationError):
            CartService.checkout(cart, Payment.Method.COD, self.customer)

    def test_order_number_uses_existing_orders_when_cache_is_empty(self):
        cart = CartService.initialize_cart(
            self.customer,
            self.restaurant,
            self.location,
            self.slot,
            timezone.localdate() + timedelta(days=1),
        )
        CartService.add_item(cart, self.item, 1)
        first_order = CartService.checkout(cart, Payment.Method.COD, self.customer)

        from django.core.cache import cache
        cache.clear()

        second_customer = User.objects.create_user(email="user9000000005@preplate.local", phone="9000000005", role=User.Role.CUSTOMER)
        second_location = DeliveryLocation.objects.create(
            restaurant=self.restaurant,
            name="Gate B",
            address="Second gate",
            capacity_per_slot=10,
        )
        second_cart = CartService.initialize_cart(
            second_customer,
            self.restaurant,
            second_location,
            self.slot,
            timezone.localdate() + timedelta(days=1),
        )
        CartService.add_item(second_cart, self.item, 1)
        second_order = CartService.checkout(second_cart, Payment.Method.COD, second_customer)

        self.assertNotEqual(first_order.order_number, second_order.order_number)
        self.assertTrue(second_order.order_number.endswith("000002"))
