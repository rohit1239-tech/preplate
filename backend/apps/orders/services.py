from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.orders.models import Order, OrderStatusHistory
from apps.payments.models import Payment


class OrderStateMachine:
    valid_transitions = {
        Order.Status.PLACED: {Order.Status.CONFIRMED, Order.Status.CANCELLED},
        Order.Status.CONFIRMED: {Order.Status.PREPARING, Order.Status.CANCELLED},
        Order.Status.PREPARING: {Order.Status.OUT_FOR_DELIVERY, Order.Status.CANCELLED},
        Order.Status.OUT_FOR_DELIVERY: {Order.Status.REACHED},
        Order.Status.REACHED: {Order.Status.DELIVERED},
        Order.Status.DELIVERED: set(),
        Order.Status.CANCELLED: set(),
    }

    @classmethod
    @transaction.atomic
    def transition(cls, order: Order, target_status: str, actor, note: str = "") -> Order:
        if actor.role not in {"RESTAURANT_ADMIN", "PLATFORM_ADMIN"}:
            raise PermissionDenied("Only restaurant or platform admins can update orders.")
        if actor.role == "RESTAURANT_ADMIN" and order.restaurant.owner_id != actor.id:
            raise PermissionDenied("You do not manage this restaurant.")
        if target_status == Order.Status.DELIVERED:
            raise ValidationError("Use PIN verification to deliver an order.")
        cls._validate(order.status, target_status)
        return cls._save_transition(order, target_status, actor, note)

    @classmethod
    def verify_pin(cls, order: Order, pin: str, actor) -> Order:
        if order.status != Order.Status.REACHED:
            raise ValidationError("PIN can only be verified after the order reaches the delivery point.")
        if order.delivery_pin_attempts >= 3:
            raise PermissionDenied("Max PIN attempts reached. Contact support.")
        if pin != order.delivery_pin:
            order.delivery_pin_attempts += 1
            order.save(update_fields=["delivery_pin_attempts", "updated_at"])
            raise ValidationError("Invalid delivery PIN.")
        order = cls._save_transition(order, Order.Status.DELIVERED, actor, "PIN verified")
        if hasattr(order, "payment") and order.payment.method == Payment.Method.COD:
            order.payment.status = Payment.Status.SUCCESS
            order.payment.save(update_fields=["status", "updated_at"])
            order.payment_status = Order.PaymentStatus.SUCCESS
            order.save(update_fields=["payment_status", "updated_at"])
        return order

    @classmethod
    def _validate(cls, from_status: str, to_status: str) -> None:
        if to_status not in cls.valid_transitions.get(from_status, set()):
            raise ValidationError(f"Invalid transition from {from_status} to {to_status}.")

    @classmethod
    def _save_transition(cls, order: Order, target_status: str, actor, note: str) -> Order:
        cls._validate(order.status, target_status)
        from_status = order.status
        order.status = target_status
        order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            order=order,
            from_status=from_status,
            to_status=target_status,
            changed_by=actor,
            note=note,
        )
        return order
