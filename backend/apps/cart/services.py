import logging
import random
from decimal import Decimal

from django.core.cache import cache
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.cart.models import Cart, CartItem
from apps.delivery_locations.models import RestaurantDeliveryLocation
from apps.menus.models import MenuItem
from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.payments.models import Payment

logger = logging.getLogger(__name__)


class CartValidationService:
    @classmethod
    def validate_cutoff(cls, cart: Cart) -> None:
        today = timezone.localdate()
        if cart.delivery_date < today:
            raise ValidationError("Delivery date cannot be in the past.")
        if cart.delivery_date == today and timezone.localtime().time() >= cart.slot.cutoff_time:
            raise ValidationError(f"Ordering is closed for {cart.slot.name} today.")

    @classmethod
    def validate_cart(cls, cart: Cart) -> None:
        if cart.status != Cart.Status.ACTIVE:
            raise ValidationError("Cart is not active.")
        if not cart.restaurant.is_active or cart.restaurant.status != "APPROVED":
            raise ValidationError("Restaurant is not available.")
        if not cart.slot.is_active:
            raise ValidationError("Slot is not available.")
        if not cart.delivery_location.is_active:
            raise ValidationError("Delivery location is not available.")
        cls.get_service_location(cart)
        if not cart.items.exists():
            raise ValidationError("Cart has no items.")
        cls.validate_cutoff(cart)
        unavailable = cart.items.filter(menu_item__is_available=False) | cart.items.filter(menu_item__is_active=False)
        if unavailable.exists():
            raise ValidationError("Some cart items are no longer available.")

    @classmethod
    def get_service_location(cls, cart: Cart) -> RestaurantDeliveryLocation:
        try:
            return RestaurantDeliveryLocation.objects.get(
                restaurant=cart.restaurant,
                delivery_location=cart.delivery_location,
                is_active=True,
                delivery_location__is_active=True,
            )
        except RestaurantDeliveryLocation.DoesNotExist as exc:
            raise ValidationError("Restaurant does not serve this delivery location.") from exc

    @classmethod
    def validate_capacity(cls, cart: Cart) -> None:
        service_location = cls.get_service_location(cart)
        current_orders = (
            Order.objects.select_for_update()
            .filter(
                restaurant=cart.restaurant,
                delivery_location=cart.delivery_location,
                slot=cart.slot,
                delivery_date=cart.delivery_date,
            )
            .exclude(status=Order.Status.CANCELLED)
            .count()
        )
        if current_orders >= service_location.capacity_per_slot:
            raise ValidationError("Restaurant delivery capacity exceeded for this location and slot.")


class CartService:
    @classmethod
    @transaction.atomic
    def initialize_cart(cls, customer, restaurant, delivery_location, slot, delivery_date) -> Cart:
        logger.info("cart_initialize_requested", extra={"user_id": str(customer.id), "restaurant_id": str(restaurant.id), "delivery_location_id": str(delivery_location.id), "slot_id": str(slot.id), "delivery_date": delivery_date})
        if slot.restaurant_id != restaurant.id:
            logger.warning("cart_initialize_rejected_mismatched_slot", extra={"user_id": str(customer.id), "restaurant_id": str(restaurant.id), "delivery_location_id": str(delivery_location.id), "slot_id": str(slot.id)})
            raise ValidationError("Slot must belong to the selected restaurant.")
        if not RestaurantDeliveryLocation.objects.filter(restaurant=restaurant, delivery_location=delivery_location, is_active=True, delivery_location__is_active=True).exists():
            logger.warning("cart_initialize_rejected_unserved_location", extra={"user_id": str(customer.id), "restaurant_id": str(restaurant.id), "delivery_location_id": str(delivery_location.id), "slot_id": str(slot.id)})
            raise ValidationError("Restaurant does not serve this delivery location.")
        abandoned_count = Cart.objects.filter(customer=customer, status=Cart.Status.ACTIVE).update(status=Cart.Status.ABANDONED)
        if abandoned_count:
            logger.info("active_carts_abandoned", extra={"user_id": str(customer.id), "count": abandoned_count})
        cart = Cart.objects.create(
            customer=customer,
            restaurant=restaurant,
            delivery_location=delivery_location,
            slot=slot,
            delivery_date=delivery_date,
        )
        CartValidationService.validate_cutoff(cart)
        logger.info("cart_initialized", extra={"cart_id": str(cart.id), "user_id": str(customer.id), "restaurant_id": str(restaurant.id)})
        return cart

    @classmethod
    @transaction.atomic
    def add_item(cls, cart: Cart, menu_item: MenuItem, quantity: int) -> CartItem:
        logger.info("cart_add_item_requested", extra={"cart_id": str(cart.id), "menu_item_id": str(menu_item.id), "quantity": quantity})
        if cart.status != Cart.Status.ACTIVE:
            logger.warning("cart_add_item_rejected_inactive_cart", extra={"cart_id": str(cart.id), "status": cart.status})
            raise ValidationError("Cart is not active.")
        if menu_item.restaurant_id != cart.restaurant_id:
            logger.warning("cart_add_item_rejected_wrong_restaurant", extra={"cart_id": str(cart.id), "menu_item_id": str(menu_item.id), "cart_restaurant_id": str(cart.restaurant_id), "item_restaurant_id": str(menu_item.restaurant_id)})
            raise ValidationError("Menu item must belong to cart restaurant.")
        if not menu_item.is_available or not menu_item.is_active:
            logger.warning("cart_add_item_rejected_unavailable_item", extra={"cart_id": str(cart.id), "menu_item_id": str(menu_item.id), "is_available": menu_item.is_available, "is_active": menu_item.is_active})
            raise ValidationError("Menu item is not available.")
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            menu_item=menu_item,
            defaults={"quantity": quantity, "unit_price": menu_item.price},
        )
        if not created:
            item.quantity += quantity
            item.save(update_fields=["quantity", "updated_at"])
        logger.info("cart_item_saved", extra={"cart_id": str(cart.id), "cart_item_id": str(item.id), "menu_item_id": str(menu_item.id), "quantity": item.quantity, "item_created": created})
        return item

    @classmethod
    @transaction.atomic
    def checkout(cls, cart: Cart, payment_method: str, actor) -> Order:
        logger.info("cart_checkout_requested", extra={"cart_id": str(cart.id), "actor_id": str(actor.id), "payment_method": payment_method})
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        CartValidationService.validate_cart(cart)
        CartValidationService.validate_capacity(cart)
        cart_items = list(cart.items.select_related("menu_item"))
        subtotal = sum((item.line_total for item in cart_items), Decimal("0"))
        discount_amount = Decimal("0")
        delivery_fee = Decimal("0")
        total = subtotal - discount_amount + delivery_fee
        order = Order.objects.create(
            order_number=cls._generate_order_number(),
            customer=cart.customer,
            restaurant=cart.restaurant,
            delivery_location=cart.delivery_location,
            slot=cart.slot,
            delivery_date=cart.delivery_date,
            delivery_pin=f"{random.randint(0, 9999):04d}",
            subtotal=subtotal,
            discount_amount=discount_amount,
            delivery_fee=delivery_fee,
            total=total,
        )
        for item in cart_items:
            OrderItem.objects.create(
                order=order,
                menu_item=item.menu_item,
                name=item.menu_item.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
            )
        Payment.objects.create(order=order, method=payment_method, amount=total)
        OrderStatusHistory.objects.create(order=order, from_status="", to_status=Order.Status.PLACED, changed_by=actor)
        cart.status = Cart.Status.CHECKED_OUT
        cart.save(update_fields=["status", "updated_at"])
        logger.info("cart_checkout_succeeded", extra={"cart_id": str(cart.id), "order_id": str(order.id), "order_number": order.order_number, "total": str(total), "item_count": len(cart_items)})
        return order

    @staticmethod
    def _generate_order_number() -> str:
        today = timezone.localdate().strftime("%Y%m%d")
        prefix = f"ORD-{today}-"

        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", [int(today)])

        latest = (
            Order.objects.filter(order_number__startswith=prefix)
            .order_by("-order_number")
            .values_list("order_number", flat=True)
            .first()
        )
        sequence = 1
        if latest:
            try:
                sequence = int(latest.rsplit("-", 1)[1]) + 1
            except (IndexError, ValueError):
                sequence = Order.objects.filter(order_number__startswith=prefix).count() + 1

        cache.set(f"orders:sequence:{today}", sequence, 60 * 60 * 48)
        return f"{prefix}{sequence:06d}"
