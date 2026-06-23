import logging

from celery import shared_task

from apps.notifications.models import Notification
from apps.orders.models import Order

logger = logging.getLogger(__name__)


@shared_task
def order_status_notification_task(order_id: str) -> None:
    order = Order.objects.select_related("customer").get(id=order_id)
    notification = Notification.objects.create(
        user=order.customer,
        title=f"Order {order.status.replace('_', ' ').title()}",
        message=f"Your order {order.order_number} is now {order.status}.",
        type="ORDER_STATUS",
    )
    logger.info("order_status_notification_created", extra={"notification_id": str(notification.id), "order_id": str(order.id), "order_number": order.order_number, "status": order.status, "user_id": str(order.customer_id)})


@shared_task
def send_push_notification_task(notification_id: str) -> None:
    logger.info("push_notification_skipped", extra={"notification_id": notification_id, "reason": "push_provider_not_configured"})
    return None
