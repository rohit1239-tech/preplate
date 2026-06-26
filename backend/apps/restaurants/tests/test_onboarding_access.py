from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.restaurants.models import Restaurant


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"], DEBUG=True)
class PendingRestaurantAccessTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="pending-owner@preplate.local",
            role=User.Role.RESTAURANT_ADMIN,
            phone="9999000301",
            first_name="Asha",
            last_name="Owner",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Pending Kitchen",
            phone="9999000302",
            description="Waiting for approval",
            status=Restaurant.Status.PENDING,
            is_active=True,
        )
        self.client.force_authenticate(self.owner)

    def test_pending_owner_can_read_own_restaurant_status(self) -> None:
        response = self.client.get("/api/v1/restaurants/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.assertEqual(response.json()["results"][0]["id"], str(self.restaurant.id))
        self.assertEqual(response.json()["results"][0]["status"], Restaurant.Status.PENDING)

    def test_platform_admin_can_review_owner_contact_for_restaurant_approval(self) -> None:
        admin = User.objects.create_user(
            email="platform-admin@preplate.local",
            role=User.Role.PLATFORM_ADMIN,
            phone="9999000399",
        )
        self.client.force_authenticate(admin)

        response = self.client.get("/api/v1/restaurants/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        restaurant = response.json()["results"][0]
        self.assertEqual(restaurant["owner_email"], "pending-owner@preplate.local")
        self.assertEqual(restaurant["owner_first_name"], "Asha")
        self.assertEqual(restaurant["owner_last_name"], "Owner")
        self.assertEqual(restaurant["owner_phone"], "9999000301")
        self.assertEqual(restaurant["phone"], "9999000302")

    def test_public_restaurant_response_does_not_expose_owner_contact(self) -> None:
        self.restaurant.status = Restaurant.Status.APPROVED
        self.restaurant.save(update_fields=["status", "updated_at"])
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/v1/restaurants/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        restaurant = response.json()["results"][0]
        self.assertIsNone(restaurant["owner_email"])
        self.assertIsNone(restaurant["owner_first_name"])
        self.assertIsNone(restaurant["owner_last_name"])
        self.assertIsNone(restaurant["owner_phone"])

    def test_pending_owner_cannot_update_restaurant_settings(self) -> None:
        response = self.client.patch(
            f"/api/v1/restaurants/{self.restaurant.id}/",
            {"name": "Changed Pending Kitchen"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pending_owner_cannot_access_operational_catalog_apis(self) -> None:
        endpoints = [
            "/api/v1/menu-categories/",
            "/api/v1/menu-items/",
            "/api/v1/delivery-locations/",
            "/api/v1/slots/",
        ]

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint, {"restaurant": str(self.restaurant.id)})
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pending_owner_cannot_access_restaurant_analytics(self) -> None:
        response = self.client.get("/api/v1/analytics/restaurant/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_approved_owner_gets_operational_access(self) -> None:
        self.restaurant.status = Restaurant.Status.APPROVED
        self.restaurant.save(update_fields=["status", "updated_at"])

        response = self.client.get("/api/v1/menu-categories/", {"restaurant": str(self.restaurant.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
