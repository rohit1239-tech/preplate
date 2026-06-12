from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.cart.models import Cart


@shared_task
def cleanup_abandoned_carts_task() -> int:
    cutoff = timezone.now() - timedelta(hours=24)
    return Cart.objects.filter(status=Cart.Status.ACTIVE, updated_at__lt=cutoff).update(status=Cart.Status.ABANDONED)
