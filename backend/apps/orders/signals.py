from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications.tasks import order_status_notification_task
from apps.orders.models import Order


@receiver(post_save, sender=Order)
def publish_order_status(sender, instance: Order, created: bool, **kwargs):
    if created:
        return
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"user_{instance.customer_id}",
            {
                "type": "order_status_update",
                "payload": {
                    "type": "order_status_update",
                    "order_id": str(instance.id),
                    "order_number": instance.order_number,
                    "status": instance.status,
                },
            },
        )
    order_status_notification_task.delay(str(instance.id))
