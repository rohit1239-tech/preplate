import logging
import math
import random
import time
from dataclasses import dataclass
from typing import Any

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
    email_limit = 3
    ip_limit = 10
    lock_ttl_seconds = 5

    @dataclass
    class OTPDelivery:
        otp: str
        cooldown_seconds: int
        remaining_resends: int

    class ResendCooldownError(Exception):
        def __init__(self, retry_after: int) -> None:
            self.retry_after = retry_after
            super().__init__("Please wait before requesting another OTP.")

    class ResendLimitError(Exception):
        pass

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

        with cls._session_lock(email, role):
            otp = cls._generate_otp(use_static_debug_otp=True)
            cls._store_otp_session(email, role, otp, resend_count=0)
            cls._deliver_otp(email, role, otp, masked_email)
            return otp

    @classmethod
    def resend_otp(
        cls,
        email: str,
        role: str = User.Role.CUSTOMER,
        intent: str = "LOGIN",
    ) -> OTPDelivery:
        """Resend an OTP for an active OTP session with server-side cooldown and limits."""
        email = email.lower()
        masked_email = _mask_email(email)
        cls._validate_identity(email, role, intent, masked_email)
        logger.info("otp_resend_requested", extra={"email": masked_email, "role": role, "intent": intent})

        with cls._session_lock(email, role):
            metadata = cls._get_metadata(email, role)
            expected = cache.get(cls._otp_key(email, role))
            if not metadata or not expected:
                logger.info("otp_resend_rejected_missing_session", extra={"email": masked_email, "role": role})
                raise ValidationError("No active OTP session. Request a new OTP.")

            now = cls._now()
            last_sent_at = float(metadata.get("last_sent_at", 0))
            cooldown_seconds = cls._cooldown_seconds()
            elapsed = now - last_sent_at
            if elapsed < cooldown_seconds:
                retry_after = max(1, math.ceil(cooldown_seconds - elapsed))
                logger.info("otp_resend_rejected_cooldown", extra={"email": masked_email, "role": role, "retry_after": retry_after})
                raise cls.ResendCooldownError(retry_after)

            resend_count = int(metadata.get("resend_count", 0))
            if resend_count >= cls._max_resends():
                logger.warning("otp_resend_rejected_limit", extra={"email": masked_email, "role": role, "resend_count": resend_count})
                raise cls.ResendLimitError("Maximum OTP resend attempts reached.")

            otp = cls._generate_otp(use_static_debug_otp=False)
            resend_count += 1
            cls._store_otp_session(email, role, otp, resend_count=resend_count)
            cls._deliver_otp(email, role, otp, masked_email)
            return cls.OTPDelivery(
                otp=otp,
                cooldown_seconds=cooldown_seconds,
                remaining_resends=max(cls._max_resends() - resend_count, 0),
            )

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
        cache.delete(cls._metadata_key(email, role))
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
    def _metadata_key(email: str, role: str) -> str:
        return f"otp:meta:{role}:{email}"

    @staticmethod
    def _lock_key(email: str, role: str) -> str:
        return f"otp:lock:{role}:{email}"

    @staticmethod
    def _increment_or_throttle(key: str, limit: int, ttl: int) -> None:
        value = cache.get(key)
        if value is None:
            cache.set(key, 1, ttl)
            return
        if int(value) >= limit:
            raise Throttled(detail="Rate limit exceeded.")
        cache.incr(key)

    @classmethod
    def _validate_identity(cls, email: str, role: str, intent: str, masked_email: str) -> None:
        user = User.objects.filter(email=email).first()
        if intent == "LOGIN":
            if not user:
                logger.info("otp_resend_rejected_missing_account", extra={"email": masked_email, "role": role, "intent": intent})
                raise ValidationError({"email": "No account found for this email. Create an account first."})
            if user.role != role:
                logger.warning("otp_resend_rejected_role_mismatch", extra={"email": masked_email, "requested_role": role, "actual_role": user.role})
                raise PermissionDenied("This email is registered with a different role.")
        if intent == "SIGNUP":
            if role == User.Role.PLATFORM_ADMIN:
                logger.warning("otp_resend_rejected_platform_signup", extra={"email": masked_email, "role": role})
                raise PermissionDenied("Platform admin accounts are created by backend administration only.")
            if user and user.role != role:
                logger.warning("otp_resend_rejected_role_mismatch", extra={"email": masked_email, "requested_role": role, "actual_role": user.role})
                raise PermissionDenied("This email is registered with a different role.")
            if user:
                logger.info("otp_resend_rejected_existing_account", extra={"email": masked_email, "role": role, "intent": intent})
                raise ValidationError({"email": "An account already exists for this email. Sign in instead."})

    @classmethod
    def _store_otp_session(cls, email: str, role: str, otp: str, resend_count: int) -> None:
        now = cls._now()
        ttl = cls._otp_ttl_seconds()
        metadata = {
            "resend_count": resend_count,
            "last_sent_at": now,
            "expires_at": now + ttl,
        }
        cache.set(cls._otp_key(email, role), otp, ttl)
        cache.set(cls._metadata_key(email, role), metadata, ttl)
        logger.info("otp_cached", extra={"email": _mask_email(email), "role": role, "ttl_seconds": ttl, "resend_count": resend_count})

    @classmethod
    def _get_metadata(cls, email: str, role: str) -> dict[str, Any] | None:
        metadata = cache.get(cls._metadata_key(email, role))
        return metadata if isinstance(metadata, dict) else None

    @classmethod
    def _generate_otp(cls, use_static_debug_otp: bool) -> str:
        if use_static_debug_otp and getattr(settings, "DEBUG", False):
            return "123456"
        return f"{random.randint(0, 999999):06d}"

    @staticmethod
    def _deliver_otp(email: str, role: str, otp: str, masked_email: str) -> None:
        if not getattr(settings, "DEBUG", False):
            result = send_otp_email_task.delay(email, otp)
            logger.info("otp_email_task_queued", extra={"email": masked_email, "role": role, "task_id": result.id})
        else:
            logger.debug("otp_email_task_skipped_debug", extra={"email": masked_email, "role": role})

    @classmethod
    def _session_lock(cls, email: str, role: str):
        service = cls

        class SessionLock:
            def __enter__(self) -> None:
                acquired = cache.add(service._lock_key(email, role), "1", service.lock_ttl_seconds)
                if not acquired:
                    raise Throttled(detail="OTP request already in progress. Try again shortly.")

            def __exit__(self, exc_type, exc, traceback) -> None:
                cache.delete(service._lock_key(email, role))

        return SessionLock()

    @staticmethod
    def _now() -> float:
        return time.time()

    @staticmethod
    def _otp_ttl_seconds() -> int:
        return int(getattr(settings, "OTP_EXPIRY_SECONDS", 300))

    @staticmethod
    def _cooldown_seconds() -> int:
        return int(getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 30))

    @staticmethod
    def _max_resends() -> int:
        return int(getattr(settings, "OTP_MAX_RESENDS", 3))
