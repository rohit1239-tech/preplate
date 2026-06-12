import random

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User


class OTPAuthService:
    otp_ttl_seconds = 300
    phone_limit = 3
    ip_limit = 10

    @classmethod
    def send_otp(cls, phone: str, ip_address: str | None = None) -> str:
        phone_key = f"otp:send:phone:{phone}"
        ip_key = f"otp:send:ip:{ip_address or 'unknown'}"
        cls._increment_or_throttle(phone_key, cls.phone_limit, 300)
        cls._increment_or_throttle(ip_key, cls.ip_limit, 3600)

        otp = f"{random.randint(0, 999999):06d}"
        if getattr(settings, "DEBUG", False):
            otp = "123456"
        cache.set(f"otp:value:{phone}", otp, cls.otp_ttl_seconds)
        return otp

    @classmethod
    def verify_otp(cls, phone: str, otp: str, role: str = User.Role.CUSTOMER) -> dict:
        failed_key = f"otp:failed:{phone}"
        if int(cache.get(failed_key, 0)) >= 5:
            raise Throttled(detail="Too many failed OTP attempts. Try again later.")
        expected = cache.get(f"otp:value:{phone}")
        if not expected or expected != otp:
            cls._increment_or_throttle(failed_key, 5, 3600)
            raise ValidationError("Invalid or expired OTP.")

        cache.delete(f"otp:value:{phone}")
        cache.delete(failed_key)
        user, created = User.objects.get_or_create(phone=phone, defaults={"role": role})
        if not created and role != user.role and user.role == User.Role.CUSTOMER:
            user.role = role
            user.save(update_fields=["role"])
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user,
        }

    @staticmethod
    def _increment_or_throttle(key: str, limit: int, ttl: int) -> None:
        value = cache.get(key)
        if value is None:
            cache.set(key, 1, ttl)
            return
        if int(value) >= limit:
            raise Throttled(detail="Rate limit exceeded.")
        cache.incr(key)
