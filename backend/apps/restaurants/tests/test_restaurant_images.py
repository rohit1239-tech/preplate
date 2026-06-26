import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.restaurants.models import Restaurant


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="preplate-restaurant-images-")


@override_settings(ALLOWED_HOSTS=["testserver"], MEDIA_ROOT=TEST_MEDIA_ROOT, MEDIA_URL="/media/")
class RestaurantImageAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email="restaurant-image-owner@preplate.local",
            role=User.Role.RESTAURANT_ADMIN,
            phone="9999000201",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name="Photo Kitchen",
            phone="9999000202",
            description="Restaurant with a real photo",
            status=Restaurant.Status.APPROVED,
            is_active=True,
        )

    def test_restaurant_admin_can_upload_and_public_can_read_restaurant_image_url(self) -> None:
        self.client.force_authenticate(self.owner)
        image = SimpleUploadedFile(
            "restaurant.gif",
            b"GIF87a\x01\x00\x01\x00\x80\x01\x00\x00\x00\x00ccc,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
            content_type="image/gif",
        )

        update = self.client.patch(
            f"/api/v1/restaurants/{self.restaurant.id}/",
            {
                "name": self.restaurant.name,
                "description": self.restaurant.description,
                "phone": self.restaurant.phone,
                "image": image,
            },
            format="multipart",
        )

        self.assertEqual(update.status_code, status.HTTP_200_OK, update.json())
        self.assertIn("/media/restaurants/", update.json()["image"])

        self.client.force_authenticate(user=None)
        detail = self.client.get(f"/api/v1/restaurants/{self.restaurant.id}/")

        self.assertEqual(detail.status_code, status.HTTP_200_OK, detail.json())
        self.assertEqual(detail.json()["image"], update.json()["image"])
