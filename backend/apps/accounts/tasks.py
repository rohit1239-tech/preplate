from celery import shared_task


@shared_task
def send_otp_task(phone: str, otp: str) -> None:
    return None


@shared_task
def cleanup_expired_otp_task() -> None:
    return None
