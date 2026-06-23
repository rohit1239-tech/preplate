import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "<invalid-email>"
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def send_otp_email_task(self, email: str, otp: str) -> int:
    masked_email = _mask_email(email)
    logger.info("otp_email_send_started", extra={"email": masked_email, "task_id": self.request.id})
    sent_count = send_mail(
        "Your Preplate verification code",
        f"Your Preplate verification code is {otp}. It expires in 5 minutes.",
        getattr(settings, "DEFAULT_FROM_EMAIL", None),
        [email],
        fail_silently=False,
    )
    logger.info("otp_email_send_finished", extra={"email": masked_email, "task_id": self.request.id, "sent_count": sent_count})
    return sent_count


@shared_task
def cleanup_expired_otp_task() -> None:
    return None
