from datetime import time

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.restaurants.models import Restaurant
from apps.slots.models import DeliverySlot


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"], DEBUG=True)
class DeliverySlotAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="slot-owner@preplate.local",
            role=User.Role.RESTAURANT_ADMIN,
            phone="9999000401",
        )
        self.other_owner = User.objects.create_user(
            email="other-slot-owner@preplate.local",
            role=User.Role.RESTAURANT_ADMIN,
            phone="9999000402",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Early Kitchen",
            phone="9999000403",
            status=Restaurant.Status.APPROVED,
        )
        self.other_restaurant = Restaurant.objects.create(
            owner=self.other_owner,
            name="Late Kitchen",
            phone="9999000404",
            status=Restaurant.Status.APPROVED,
        )
        self.restaurant_slot = DeliverySlot.objects.create(
            restaurant=self.restaurant,
            name="Lunch",
            cutoff_time=time(10, 30),
            delivery_start_time=time(12, 0),
            delivery_end_time=time(13, 0),
        )
        DeliverySlot.objects.create(
            restaurant=self.other_restaurant,
            name="Lunch",
            cutoff_time=time(11, 45),
            delivery_start_time=time(12, 30),
            delivery_end_time=time(13, 30),
        )

    def test_customer_slot_list_filters_cutoff_by_restaurant(self) -> None:
        response = self.client.get("/api/v1/slots/", {"restaurant": str(self.restaurant.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.assertEqual(response.json()["count"], 1)
        slot = response.json()["results"][0]
        self.assertEqual(slot["id"], str(self.restaurant_slot.id))
        self.assertEqual(slot["restaurant"], str(self.restaurant.id))
        self.assertEqual(slot["cutoff_time"], "10:30:00")
