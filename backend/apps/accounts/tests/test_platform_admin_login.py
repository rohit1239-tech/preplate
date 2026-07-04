from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"])
class PlatformAdminLoginAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.password = "Admin@12345"
        self.admin = User.objects.create_superuser(
            email="admin-login@preplate.local",
            password=self.password,
        )

    def test_platform_admin_can_login_with_email_and_password(self) -> None:
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.admin.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())
        self.assertEqual(response.json()["user"]["email"], self.admin.email)
        self.assertEqual(response.json()["user"]["role"], User.Role.PLATFORM_ADMIN)

    def test_wrong_password_is_rejected(self) -> None:
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.admin.email, "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_platform_admin_is_rejected(self) -> None:
        user = User.objects.create_user(
            email="customer-login@preplate.local",
            password=self.password,
            role=User.Role.CUSTOMER,
        )

        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
