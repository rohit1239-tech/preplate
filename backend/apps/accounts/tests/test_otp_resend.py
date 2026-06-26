from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.services import OTPAuthService


@override_settings(
    ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
    DEBUG=True,
    OTP_RESEND_COOLDOWN_SECONDS=30,
    OTP_MAX_RESENDS=3,
    OTP_EXPIRY_SECONDS=300,
)
class OTPResendAPITests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()
        self.email = "resend-customer@preplate.local"
        self.payload = {"email": self.email, "role": User.Role.CUSTOMER, "intent": "SIGNUP"}

    def _send_signup_otp(self) -> str:
        response = self.client.post("/api/v1/auth/otp/send/", self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        return response.json()["debug_otp"]

    def _expire_cooldown(self) -> None:
        metadata = cache.get(OTPAuthService._metadata_key(self.email, User.Role.CUSTOMER))
        self.assertIsNotNone(metadata)
        metadata["last_sent_at"] -= 31
        cache.set(OTPAuthService._metadata_key(self.email, User.Role.CUSTOMER), metadata, 300)

    def test_resend_before_cooldown_returns_retry_after(self) -> None:
        self._send_signup_otp()

        response = self.client.post("/api/v1/auth/otp/resend/", self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.json()["message"], "Please wait before requesting another OTP.")
        self.assertGreaterEqual(response.json()["retry_after"], 1)
        self.assertLessEqual(response.json()["retry_after"], 30)

    def test_resend_after_cooldown_replaces_otp_and_updates_metadata(self) -> None:
        old_otp = self._send_signup_otp()
        self._expire_cooldown()

        with patch("apps.accounts.services.random.randint", return_value=654321):
            response = self.client.post("/api/v1/auth/otp/resend/", self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.assertEqual(response.json()["message"], "OTP sent successfully.")
        self.assertEqual(response.json()["cooldown_seconds"], 30)
        self.assertEqual(response.json()["remaining_resends"], 2)
        self.assertEqual(response.json()["debug_otp"], "654321")
        self.assertNotEqual(response.json()["debug_otp"], old_otp)

        metadata = cache.get(OTPAuthService._metadata_key(self.email, User.Role.CUSTOMER))
        self.assertEqual(metadata["resend_count"], 1)
        self.assertIn("last_sent_at", metadata)
        self.assertIn("expires_at", metadata)
        self.assertEqual(cache.get(OTPAuthService._otp_key(self.email, User.Role.CUSTOMER)), "654321")

    def test_resend_limit_is_enforced(self) -> None:
        self._send_signup_otp()

        for code in [111111, 222222, 333333]:
            self._expire_cooldown()
            with patch("apps.accounts.services.random.randint", return_value=code):
                response = self.client.post("/api/v1/auth/otp/resend/", self.payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())

        self._expire_cooldown()
        response = self.client.post("/api/v1/auth/otp/resend/", self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.json()["message"], "Maximum OTP resend attempts reached.")

    def test_old_otp_is_invalid_and_new_otp_verifies(self) -> None:
        old_otp = self._send_signup_otp()
        self._expire_cooldown()
        with patch("apps.accounts.services.random.randint", return_value=987654):
            resend = self.client.post("/api/v1/auth/otp/resend/", self.payload, format="json")
        self.assertEqual(resend.status_code, status.HTTP_200_OK, resend.json())

        signup_data = {
            "email": self.email,
            "role": User.Role.CUSTOMER,
            "first_name": "Resend",
            "last_name": "User",
            "mobile": "9999012345",
        }
        old_verify = self.client.post("/api/v1/auth/otp/verify/", {**signup_data, "otp": old_otp}, format="json")
        self.assertEqual(old_verify.status_code, status.HTTP_400_BAD_REQUEST)

        new_verify = self.client.post("/api/v1/auth/otp/verify/", {**signup_data, "otp": "987654"}, format="json")
        self.assertEqual(new_verify.status_code, status.HTTP_200_OK, new_verify.json())
        self.assertIsNone(cache.get(OTPAuthService._metadata_key(self.email, User.Role.CUSTOMER)))

    def test_existing_session_lock_blocks_concurrent_resend(self) -> None:
        self._send_signup_otp()
        self._expire_cooldown()
        cache.add(OTPAuthService._lock_key(self.email, User.Role.CUSTOMER), "1", 5)

        response = self.client.post("/api/v1/auth/otp/resend/", self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.json()["message"], "OTP request already in progress. Try again shortly.")
