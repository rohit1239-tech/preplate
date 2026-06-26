import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.restaurants.models import Restaurant


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="preplate-location-images-")


@override_settings(ALLOWED_HOSTS=["testserver"], MEDIA_ROOT=TEST_MEDIA_ROOT, MEDIA_URL="/media/")
class DeliveryLocationImageAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="location-owner@preplate.local",
            role=User.Role.RESTAURANT_ADMIN,
            phone="9999000101",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Location Image Kitchen",
            phone="9999000102",
            status=Restaurant.Status.APPROVED,
            is_active=True,
        )

    def test_restaurant_admin_can_upload_and_customer_can_read_location_image_url(self) -> None:
        self.client.force_authenticate(self.owner)
        image = SimpleUploadedFile(
            "gate.gif",
            b"GIF87a\x01\x00\x01\x00\x80\x01\x00\x00\x00\x00ccc,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
            content_type="image/gif",
        )

        create = self.client.post(
            "/api/v1/delivery-locations/",
            {
                "restaurant": str(self.restaurant.id),
                "name": "Gate A",
                "address": "Main entrance",
                "capacity_per_slot": 50,
                "is_active": True,
                "image": image,
            },
            format="multipart",
        )

        self.assertEqual(create.status_code, status.HTTP_201_CREATED, create.json())
        self.assertIn("/media/delivery-locations/", create.json()["image"])

        self.client.force_authenticate(user=None)
        listing = self.client.get("/api/v1/delivery-locations/", {"restaurant": str(self.restaurant.id)})

        self.assertEqual(listing.status_code, status.HTTP_200_OK, listing.json())
        self.assertEqual(listing.json()["results"][0]["image"], create.json()["image"])
