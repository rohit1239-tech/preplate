from datetime import time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.delivery_locations.models import DeliveryLocation, RestaurantDeliveryLocation
from apps.menus.models import MenuCategory, MenuItem
from apps.notifications.models import Notification
from apps.notifications.tasks import order_status_notification_task
from apps.orders.models import Order
from apps.orders.services import OrderStateMachine
from apps.payments.models import Payment
from apps.restaurants.models import Restaurant
from apps.slots.models import DeliverySlot


class OrderStateMachineTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email="user9100000001@preplate.local",
            phone="9100000001",
            role=User.Role.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            email="user9100000002@preplate.local",
            phone="9100000002",
            role=User.Role.RESTAURANT_ADMIN,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Kitchen",
            phone="9100000003",
            status=Restaurant.Status.APPROVED,
        )
        self.location = DeliveryLocation.objects.create(
            name="Gate", address="Main gate"
        )
        RestaurantDeliveryLocation.objects.create(
            restaurant=self.restaurant,
            delivery_location=self.location,
            capacity_per_slot=50,
        )
        self.slot = DeliverySlot.objects.create(
            restaurant=self.restaurant,
            name="Lunch",
            cutoff_time=time(23, 59),
            delivery_start_time=time(12, 0),
            delivery_end_time=time(13, 0),
        )
        category = MenuCategory.objects.create(restaurant=self.restaurant, name="Meals")
        self.item = MenuItem.objects.create(
            restaurant=self.restaurant,
            category=category,
            name="Thali",
            price=Decimal("100.00"),
        )
        self.order = Order.objects.create(
            order_number="ORD-TEST-000001",
            customer=self.customer,
            restaurant=self.restaurant,
            delivery_location=self.location,
            slot=self.slot,
            delivery_date=timezone.localdate() + timedelta(days=1),
            delivery_pin="1234",
            subtotal=Decimal("100.00"),
            total=Decimal("100.00"),
        )
        Payment.objects.create(
            order=self.order, method=Payment.Method.COD, amount=self.order.total
        )

    def test_valid_status_transition(self):
        order = OrderStateMachine.transition(
            self.order, Order.Status.CONFIRMED, self.owner
        )
        self.assertEqual(order.status, Order.Status.CONFIRMED)
        self.assertEqual(order.history.first().to_status, Order.Status.CONFIRMED)

    def test_invalid_status_transition_is_rejected(self):
        with self.assertRaises(ValidationError):
            OrderStateMachine.transition(
                self.order, Order.Status.OUT_FOR_DELIVERY, self.owner
            )

    def test_cancel_requires_reason(self):
        with self.assertRaises(ValidationError):
            OrderStateMachine.transition(self.order, Order.Status.CANCELLED, self.owner)

    def test_cancel_stores_reason_and_notifies_customer(self):
        order = OrderStateMachine.transition(
            self.order,
            Order.Status.CANCELLED,
            self.owner,
            "Kitchen ran out of stock",
        )

        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.assertEqual(order.history.first().note, "Kitchen ran out of stock")

        order_status_notification_task(str(order.id))

        notification = Notification.objects.get(user=self.customer)
        self.assertIn("Kitchen ran out of stock", notification.message)

    def test_customer_cannot_update_status(self):
        with self.assertRaises(PermissionDenied):
            OrderStateMachine.transition(
                self.order, Order.Status.CONFIRMED, self.customer
            )

    def test_pin_verification_delivers_and_marks_cod_paid(self):
        self.order.status = Order.Status.REACHED
        self.order.save(update_fields=["status"])

        order = OrderStateMachine.verify_pin(self.order, "1234", self.owner)

        self.assertEqual(order.status, Order.Status.DELIVERED)
        self.assertEqual(order.payment.status, Payment.Status.SUCCESS)
        self.assertEqual(order.payment_status, Order.PaymentStatus.SUCCESS)

    def test_pin_locks_after_three_failures(self):
        self.order.status = Order.Status.REACHED
        self.order.save(update_fields=["status"])

        for _ in range(3):
            with self.assertRaises(ValidationError):
                OrderStateMachine.verify_pin(self.order, "0000", self.owner)
            self.order.refresh_from_db()

        with self.assertRaises(PermissionDenied):
            OrderStateMachine.verify_pin(self.order, "1234", self.owner)
