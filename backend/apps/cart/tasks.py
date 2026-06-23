import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.cart.models import Cart

logger = logging.getLogger(__name__)


@shared_task
def cleanup_abandoned_carts_task() -> int:
    cutoff = timezone.now() - timedelta(hours=24)
    updated_count = Cart.objects.filter(status=Cart.Status.ACTIVE, updated_at__lt=cutoff).update(status=Cart.Status.ABANDONED)
    logger.info("abandoned_carts_cleanup_finished", extra={"updated_count": updated_count, "cutoff": cutoff.isoformat()})
    return updated_count
