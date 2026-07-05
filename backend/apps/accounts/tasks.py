import logging

from anymail.exceptions import AnymailRequestsAPIError
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "<invalid-email>"
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


def _build_otp_html(otp: str, expiry_minutes: int) -> str:
    """Return a branded HTML email body for OTP delivery."""
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Preplate OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🍽️ Preplate</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your food, your way.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Verify your email</h2>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
                Use the code below to complete your sign-in. It expires in <strong>{expiry_minutes} minute{'s' if expiry_minutes != 1 else ''}</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border:2px solid #fed7aa;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 6px;color:#9a3412;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Your verification code</p>
                <p style="margin:0;color:#c2410c;font-size:48px;font-weight:800;letter-spacing:12px;font-variant-numeric:tabular-nums;">{otp}</p>
              </div>

              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                If you didn't request this code, you can safely ignore this email. Someone may have entered your email by mistake.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                © 2026 Preplate · This is an automated message, please do not reply.<br/>
                Need help? Contact us at <a href="mailto:support@rohityengantiwar.in" style="color:#f97316;text-decoration:none;">support@rohityengantiwar.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


@shared_task(bind=True, max_retries=3)
def send_otp_email_task(self, email: str, otp: str) -> int:
    masked_email = _mask_email(email)
    logger.info("otp_email_send_started", extra={"email": masked_email, "task_id": self.request.id})
    expiry_minutes = max(1, int(getattr(settings, "OTP_EXPIRY_SECONDS", 300)) // 60)

    subject = "Your Preplate verification code"
    plain_text = f"Your Preplate verification code is {otp}. It expires in {expiry_minutes} minutes."
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

    msg = EmailMultiAlternatives(subject, plain_text, from_email, [email])
    msg.attach_alternative(_build_otp_html(otp, expiry_minutes), "text/html")

    try:
        sent_count = msg.send()
    except AnymailRequestsAPIError as exc:
        if exc.response is not None and exc.response.status_code == 429:
            raise self.retry(exc=exc, countdown=10)
        logger.error("otp_email_send_failed", extra={"email": masked_email, "error": str(exc)})
        raise

    logger.info("otp_email_send_finished", extra={"email": masked_email, "task_id": self.request.id, "sent_count": sent_count})
    return sent_count


@shared_task
def cleanup_expired_otp_task() -> None:
    return None
