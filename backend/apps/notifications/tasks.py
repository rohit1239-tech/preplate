from celery import shared_task

from apps.notifications.models import Notification
from apps.orders.models import Order


@shared_task
def order_status_notification_task(order_id: str) -> None:
    order = Order.objects.select_related("customer").get(id=order_id)
    Notification.objects.create(
        user=order.customer,
        title=f"Order {order.status.replace('_', ' ').title()}",
        message=f"Your order {order.order_number} is now {order.status}.",
        type="ORDER_STATUS",
    )


@shared_task
def send_push_notification_task(notification_id: str) -> None:
    return None
