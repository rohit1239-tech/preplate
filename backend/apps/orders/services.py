import logging
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.orders.models import Order, OrderStatusHistory
from apps.payments.models import Payment

logger = logging.getLogger(__name__)


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
    def transition(
        cls, order: Order, target_status: str, actor, note: str = ""
    ) -> Order:
        logger.info(
            "order_transition_requested",
            extra={
                "order_id": str(order.id),
                "order_number": order.order_number,
                "from_status": order.status,
                "to_status": target_status,
                "actor_id": str(actor.id),
                "actor_role": actor.role,
            },
        )
        if actor.role not in {"RESTAURANT_ADMIN", "PLATFORM_ADMIN"}:
            logger.warning(
                "order_transition_rejected_actor_role",
                extra={
                    "order_id": str(order.id),
                    "actor_id": str(actor.id),
                    "actor_role": actor.role,
                },
            )
            raise PermissionDenied(
                "Only restaurant or platform admins can update orders."
            )
        if actor.role == "RESTAURANT_ADMIN" and order.restaurant.owner_id != actor.id:
            logger.warning(
                "order_transition_rejected_wrong_owner",
                extra={
                    "order_id": str(order.id),
                    "actor_id": str(actor.id),
                    "restaurant_id": str(order.restaurant_id),
                },
            )
            raise PermissionDenied("You do not manage this restaurant.")
        if target_status == Order.Status.DELIVERED:
            logger.warning(
                "order_transition_rejected_delivered_without_pin",
                extra={"order_id": str(order.id), "actor_id": str(actor.id)},
            )
            raise ValidationError("Use PIN verification to deliver an order.")
        if target_status == Order.Status.CANCELLED and not note.strip():
            logger.warning(
                "order_transition_rejected_missing_cancel_reason",
                extra={"order_id": str(order.id), "actor_id": str(actor.id)},
            )
            raise ValidationError("Cancellation reason is required.")
        return cls._save_transition(order, target_status, actor, note)

    @classmethod
    def verify_pin(cls, order: Order, pin: str, actor) -> Order:
        logger.info(
            "order_pin_verify_requested",
            extra={
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
                "actor_id": str(actor.id),
            },
        )
        if order.status != Order.Status.REACHED:
            logger.warning(
                "order_pin_verify_rejected_status",
                extra={"order_id": str(order.id), "status": order.status},
            )
            raise ValidationError(
                "PIN can only be verified after the order reaches the delivery point."
            )
        if order.delivery_pin_attempts >= 3:
            logger.warning(
                "order_pin_verify_rejected_max_attempts",
                extra={
                    "order_id": str(order.id),
                    "attempts": order.delivery_pin_attempts,
                },
            )
            raise PermissionDenied("Max PIN attempts reached. Contact support.")
        if pin != order.delivery_pin:
            order.delivery_pin_attempts += 1
            order.save(update_fields=["delivery_pin_attempts", "updated_at"])
            logger.warning(
                "order_pin_verify_failed",
                extra={
                    "order_id": str(order.id),
                    "attempts": order.delivery_pin_attempts,
                },
            )
            raise ValidationError("Invalid delivery PIN.")
        order = cls._save_transition(
            order, Order.Status.DELIVERED, actor, "PIN verified"
        )
        if hasattr(order, "payment") and order.payment.method == Payment.Method.COD:
            order.payment.status = Payment.Status.SUCCESS
            order.payment.save(update_fields=["status", "updated_at"])
            order.payment_status = Order.PaymentStatus.SUCCESS
            order.save(update_fields=["payment_status", "updated_at"])
            logger.info(
                "cod_payment_marked_success",
                extra={"order_id": str(order.id), "payment_id": str(order.payment.id)},
            )
        logger.info(
            "order_pin_verify_succeeded",
            extra={
                "order_id": str(order.id),
                "order_number": order.order_number,
                "actor_id": str(actor.id),
            },
        )
        return order

    @classmethod
    def _validate(cls, from_status: str, to_status: str) -> None:
        if to_status not in cls.valid_transitions.get(from_status, set()):
            logger.warning(
                "order_transition_invalid",
                extra={"from_status": from_status, "to_status": to_status},
            )
            raise ValidationError(
                f"Invalid transition from {from_status} to {to_status}."
            )

    @classmethod
    def _save_transition(
        cls, order: Order, target_status: str, actor, note: str
    ) -> Order:
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
        logger.info(
            "order_transition_saved",
            extra={
                "order_id": str(order.id),
                "order_number": order.order_number,
                "from_status": from_status,
                "to_status": target_status,
                "actor_id": str(actor.id),
            },
        )
        return order
