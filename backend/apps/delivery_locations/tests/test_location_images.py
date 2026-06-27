from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.delivery_locations.models import DeliveryLocation, LocationRequest, RestaurantDeliveryLocation
from apps.restaurants.models import Restaurant


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"], DEBUG=True)
class DeliveryLocationAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="location-admin@preplate.local",
            role=User.Role.PLATFORM_ADMIN,
            phone="9999000100",
        )
        self.owner = User.objects.create_user(
            email="location-owner@preplate.local",
            role=User.Role.RESTAURANT_ADMIN,
            phone="9999000101",
        )
        self.customer = User.objects.create_user(
            email="location-customer@preplate.local",
            role=User.Role.CUSTOMER,
            phone="9999000103",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Location Kitchen",
            phone="9999000102",
            status=Restaurant.Status.APPROVED,
            is_active=True,
        )

    def test_only_platform_admin_can_create_canonical_location(self) -> None:
        self.client.force_authenticate(self.owner)
        denied = self.client.post(
            "/api/v1/delivery-locations/",
            {"name": "Gate A", "address": "Main entrance", "is_active": True},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/v1/delivery-locations/",
            {"name": "Gate A", "address": "Main entrance", "latitude": "12.971600", "longitude": "77.594600", "is_active": True},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.json())
        self.assertNotIn("image", created.json())
        self.assertNotIn("restaurant", created.json())

    def test_restaurant_admin_manages_served_location_capacity(self) -> None:
        location = DeliveryLocation.objects.create(name="Gate A", address="Main entrance")
        self.client.force_authenticate(self.owner)

        created = self.client.post(
            "/api/v1/restaurant-delivery-locations/",
            {
                "restaurant": str(self.restaurant.id),
                "delivery_location": str(location.id),
                "capacity_per_slot": 40,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.json())
        self.assertEqual(created.json()["capacity_per_slot"], 40)
        self.assertEqual(created.json()["location_name"], "Gate A")

    def test_location_request_duplicate_is_blocked_by_coordinates(self) -> None:
        DeliveryLocation.objects.create(
            name="Main Gate",
            address="Main entrance",
            latitude="12.971600",
            longitude="77.594600",
        )
        self.client.force_authenticate(self.customer)

        response = self.client.post(
            "/api/v1/location-requests/",
            {
                "name": "Near Main Gate",
                "address": "Beside main entrance",
                "latitude": "12.971610",
                "longitude": "77.594610",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("matching location", str(response.json()).lower())

    def test_location_request_approval_creates_location_and_restaurant_service(self) -> None:
        request = LocationRequest.objects.create(
            requester=self.owner,
            restaurant=self.restaurant,
            name="Library Gate",
            address="Near central library",
        )
        self.client.force_authenticate(self.admin)

        approved = self.client.post(f"/api/v1/location-requests/{request.id}/approve/")

        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.json())
        request.refresh_from_db()
        self.assertEqual(request.status, LocationRequest.Status.APPROVED)
        self.assertIsNotNone(request.created_location_id)
        self.assertTrue(
            RestaurantDeliveryLocation.objects.filter(
                restaurant=self.restaurant,
                delivery_location=request.created_location,
                capacity_per_slot=50,
                is_active=True,
            ).exists()
        )
