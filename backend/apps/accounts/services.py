import logging
import random

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.accounts.tasks import send_otp_email_task
from apps.restaurants.models import Restaurant

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "<invalid-email>"
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


class OTPAuthService:
    otp_ttl_seconds = 300
    email_limit = 3
    ip_limit = 10

    @classmethod
    def send_otp(
        cls,
        email: str,
        role: str = User.Role.CUSTOMER,
        ip_address: str | None = None,
        intent: str = "LOGIN",
    ) -> str:
        email = email.lower()
        masked_email = _mask_email(email)
        user = User.objects.filter(email=email).first()
        logger.info("otp_send_requested", extra={"email": masked_email, "role": role, "intent": intent, "ip_address": ip_address})
        if intent == "LOGIN":
            if not user:
                logger.info("otp_send_rejected_missing_account", extra={"email": masked_email, "role": role, "intent": intent})
                raise ValidationError({"email": "No account found for this email. Create an account first."})
            if user.role != role:
                logger.warning("otp_send_rejected_role_mismatch", extra={"email": masked_email, "requested_role": role, "actual_role": user.role})
                raise PermissionDenied("This email is registered with a different role.")
        if intent == "SIGNUP":
            if role == User.Role.PLATFORM_ADMIN:
                logger.warning("otp_send_rejected_platform_signup", extra={"email": masked_email, "role": role})
                raise PermissionDenied("Platform admin accounts are created by backend administration only.")
            if user and user.role != role:
                logger.warning("otp_send_rejected_role_mismatch", extra={"email": masked_email, "requested_role": role, "actual_role": user.role})
                raise PermissionDenied("This email is registered with a different role.")
            if user:
                logger.info("otp_send_rejected_existing_account", extra={"email": masked_email, "role": role, "intent": intent})
                raise ValidationError({"email": "An account already exists for this email. Sign in instead."})

        email_key = f"otp:send:email:{role}:{email}"
        ip_key = f"otp:send:ip:{ip_address or 'unknown'}"
        cls._increment_or_throttle(email_key, cls.email_limit, 300)
        cls._increment_or_throttle(ip_key, cls.ip_limit, 3600)

        otp = f"{random.randint(0, 999999):06d}"
        if getattr(settings, "DEBUG", False):
            otp = "123456"
        cache.set(cls._otp_key(email, role), otp, cls.otp_ttl_seconds)
        logger.info("otp_cached", extra={"email": masked_email, "role": role, "ttl_seconds": cls.otp_ttl_seconds})
        if not getattr(settings, "DEBUG", False):
            result = send_otp_email_task.delay(email, otp)
            logger.info("otp_email_task_queued", extra={"email": masked_email, "role": role, "task_id": result.id})
        else:
            logger.debug("otp_email_task_skipped_debug", extra={"email": masked_email, "role": role})
        return otp

    @classmethod
    @transaction.atomic
    def verify_otp(cls, email: str, otp: str, role: str = User.Role.CUSTOMER, **signup_data) -> dict:
        email = email.lower()
        masked_email = _mask_email(email)
        logger.info("otp_verify_requested", extra={"email": masked_email, "role": role})
        failed_key = f"otp:failed:{email}"
        if int(cache.get(failed_key, 0)) >= 5:
            logger.warning("otp_verify_throttled", extra={"email": masked_email, "role": role})
            raise Throttled(detail="Too many failed OTP attempts. Try again later.")
        expected = cache.get(cls._otp_key(email, role))
        if not expected or expected != otp:
            cls._increment_or_throttle(failed_key, 5, 3600)
            logger.warning("otp_verify_failed", extra={"email": masked_email, "role": role, "reason": "invalid_or_expired"})
            raise ValidationError("Invalid or expired OTP.")

        user = User.objects.filter(email=email).first()
        if user:
            if user.role != role:
                logger.warning("otp_verify_rejected_role_mismatch", extra={"email": masked_email, "requested_role": role, "actual_role": user.role})
                raise PermissionDenied("This email is registered with a different role.")
        else:
            if role == User.Role.PLATFORM_ADMIN:
                logger.warning("otp_verify_rejected_platform_signup", extra={"email": masked_email, "role": role})
                raise PermissionDenied("Platform admin accounts must be created by backend administration.")
            mobile = signup_data.get("mobile")
            if mobile and User.objects.filter(phone=mobile).exists():
                logger.info("otp_verify_rejected_duplicate_mobile", extra={"email": masked_email, "role": role})
                raise ValidationError({"mobile": "This mobile number is already registered."})
            user = User.objects.create_user(
                email=email,
                role=role,
                phone=mobile,
                first_name=signup_data.get("first_name", ""),
                last_name=signup_data.get("last_name", ""),
            )
            logger.info("user_created_from_otp", extra={"email": masked_email, "role": role})
            if role == User.Role.RESTAURANT_ADMIN:
                Restaurant.objects.create(
                    owner=user,
                    name=signup_data["restaurant_name"],
                    phone=signup_data["restaurant_phone"],
                    description=signup_data.get("restaurant_description", ""),
                    status=Restaurant.Status.PENDING,
                    is_active=True,
                )
                logger.info("restaurant_onboarding_created", extra={"email": masked_email, "role": role})

        cache.delete(cls._otp_key(email, role))
        cache.delete(failed_key)
        logger.info("otp_verify_succeeded", extra={"email": masked_email, "role": role, "user_id": str(user.id)})

        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user,
        }

    @staticmethod
    def _otp_key(email: str, role: str) -> str:
        return f"otp:value:{role}:{email}"

    @staticmethod
    def _increment_or_throttle(key: str, limit: int, ttl: int) -> None:
        value = cache.get(key)
        if value is None:
            cache.set(key, 1, ttl)
            return
        if int(value) >= limit:
            raise Throttled(detail="Rate limit exceeded.")
        cache.incr(key)
