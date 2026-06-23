from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from rest_framework.test import APIClient


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"], DEBUG=True)
class FullOrderFlowAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _auth(self, email: str, role: str = "CUSTOMER") -> str:
        if role == "PLATFORM_ADMIN":
            User.objects.get_or_create(email=email, defaults={"role": User.Role.PLATFORM_ADMIN})
        send = self.client.post("/api/v1/auth/otp/send/", {"email": email, "role": role, "intent": "LOGIN" if role == "PLATFORM_ADMIN" else "SIGNUP"}, format="json")
        self.assertEqual(send.status_code, status.HTTP_200_OK)
        otp = send.json().get("debug_otp", "123456")
        payload = {"email": email, "otp": otp, "role": role}
        if role == "CUSTOMER":
            payload.update({"first_name": "Test", "last_name": "Customer", "mobile": "9999000001"})
        if role == "RESTAURANT_ADMIN":
            payload.update({
                "first_name": "Test",
                "last_name": "Owner",
                "mobile": "9999000002",
                "restaurant_name": "Pending Signup Kitchen",
                "restaurant_phone": "9999000011",
                "restaurant_description": "Signup restaurant",
            })
        verify = self.client.post("/api/v1/auth/otp/verify/", payload, format="json")
        self.assertEqual(verify.status_code, status.HTTP_200_OK, verify.json())
        return verify.json()["access"]

    def test_end_to_end_order_flow(self):
        customer_token = self._auth("customer-test@preplate.local", "CUSTOMER")
        owner_token = self._auth("owner-test@preplate.local", "RESTAURANT_ADMIN")
        admin_token = self._auth("admin-test@preplate.local", "PLATFORM_ADMIN")

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {customer_token}")
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.json()["email"], "customer-test@preplate.local")

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
        restaurant = self.client.post(
            "/api/v1/restaurants/",
            {"name": "Test Kitchen", "phone": "9999000010", "description": "Test"},
            format="json",
        )
        self.assertEqual(restaurant.status_code, status.HTTP_201_CREATED)
        restaurant_id = restaurant.json()["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        approve = self.client.post(f"/api/v1/restaurants/{restaurant_id}/approve/")
        self.assertEqual(approve.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
        location = self.client.post(
            "/api/v1/delivery-locations/",
            {
                "restaurant": restaurant_id,
                "name": "Gate A",
                "address": "Main",
                "capacity_per_slot": 5,
            },
            format="json",
        )
        self.assertEqual(location.status_code, status.HTTP_201_CREATED)
        loc_id = location.json()["id"]

        slot = self.client.post(
            "/api/v1/slots/",
            {
                "restaurant": restaurant_id,
                "name": "Lunch",
                "cutoff_time": "10:30:00",
                "delivery_start_time": "12:00:00",
                "delivery_end_time": "13:00:00",
            },
            format="json",
        )
        self.assertEqual(slot.status_code, status.HTTP_201_CREATED)
        slot_id = slot.json()["id"]

        category = self.client.post(
            "/api/v1/menu-categories/",
            {"restaurant": restaurant_id, "name": "Meals"},
            format="json",
        )
        self.assertEqual(category.status_code, status.HTTP_201_CREATED)
        cat_id = category.json()["id"]

        item = self.client.post(
            "/api/v1/menu-items/",
            {
                "restaurant": restaurant_id,
                "category": cat_id,
                "name": "Thali",
                "price": "120.00",
            },
            format="json",
        )
        self.assertEqual(item.status_code, status.HTTP_201_CREATED)
        item_id = item.json()["id"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {customer_token}")
        delivery_date = (timezone.localdate() + timedelta(days=1)).isoformat()
        cart = self.client.post(
            "/api/v1/cart/",
            {
                "restaurant_id": restaurant_id,
                "delivery_location_id": loc_id,
                "slot_id": slot_id,
                "delivery_date": delivery_date,
            },
            format="json",
        )
        self.assertEqual(cart.status_code, status.HTTP_201_CREATED)
        cart_id = cart.json()["id"]

        add_item = self.client.post(
            f"/api/v1/cart/{cart_id}/items/",
            {"menu_item_id": item_id, "quantity": 2},
            format="json",
        )
        self.assertEqual(add_item.status_code, status.HTTP_200_OK)

        checkout = self.client.post(
            f"/api/v1/cart/{cart_id}/checkout/",
            {"payment_method": "COD"},
            format="json",
        )
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)
        order = checkout.json()
        order_id = order["id"]
        pin = order["delivery_pin"]

        orders = self.client.get("/api/v1/orders/")
        self.assertEqual(orders.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(orders.json()["results"]), 1)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
        for target in ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "REACHED"]:
            response = self.client.patch(
                f"/api/v1/orders/{order_id}/status/",
                {"status": target},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())

        verify = self.client.post(
            f"/api/v1/orders/{order_id}/verify-pin/",
            {"pin": pin},
            format="json",
        )
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        self.assertEqual(verify.json()["order"]["status"], "DELIVERED")

        notifications = self.client.get("/api/v1/notifications/")
        self.assertEqual(notifications.status_code, status.HTTP_200_OK)

    def test_auth_and_permission_guards(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/v1/orders/").status_code, status.HTTP_401_UNAUTHORIZED)

        customer_token = self._auth("guard-customer@preplate.local", "CUSTOMER")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {customer_token}")
        self.assertEqual(
            self.client.get("/api/v1/analytics/platform/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        blocked_admin_otp = self.client.post(
            "/api/v1/auth/otp/send/",
            {"email": "not-an-admin@preplate.local", "role": "PLATFORM_ADMIN", "intent": "LOGIN"},
            format="json",
        )
        self.assertEqual(blocked_admin_otp.status_code, status.HTTP_403_FORBIDDEN)

        invalid = self.client.post(
            "/api/v1/auth/otp/verify/",
            {"email": "guard-customer@preplate.local", "otp": "000000"},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_intent_requires_existing_customer_before_sending_otp(self):
        missing = self.client.post(
            "/api/v1/auth/otp/send/",
            {"email": "missing-customer@preplate.local", "role": "CUSTOMER", "intent": "LOGIN"},
            format="json",
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", missing.json()["message"])

        User.objects.create_user(
            email="existing-customer@preplate.local",
            role=User.Role.CUSTOMER,
            phone="9999000088",
        )
        existing = self.client.post(
            "/api/v1/auth/otp/send/",
            {"email": "existing-customer@preplate.local", "role": "CUSTOMER", "intent": "LOGIN"},
            format="json",
        )
        self.assertEqual(existing.status_code, status.HTTP_200_OK)

    def test_signup_intent_rejects_existing_email_before_sending_otp(self):
        User.objects.create_user(
            email="already-customer@preplate.local",
            role=User.Role.CUSTOMER,
            phone="9999000087",
        )
        existing = self.client.post(
            "/api/v1/auth/otp/send/",
            {"email": "already-customer@preplate.local", "role": "CUSTOMER", "intent": "SIGNUP"},
            format="json",
        )
        self.assertEqual(existing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", existing.json()["message"])

    def test_restaurant_admin_signup_validation_does_not_consume_otp(self):
        existing = User.objects.create_user(
            email="existing-mobile@preplate.local",
            role=User.Role.CUSTOMER,
            phone="9999000099",
        )
        self.assertIsNotNone(existing.id)

        email = "restaurant-duplicate-mobile@preplate.local"
        send = self.client.post(
            "/api/v1/auth/otp/send/",
            {"email": email, "role": "RESTAURANT_ADMIN", "intent": "SIGNUP"},
            format="json",
        )
        self.assertEqual(send.status_code, status.HTTP_200_OK)
        otp = send.json().get("debug_otp", "123456")

        payload = {
            "email": email,
            "otp": otp,
            "role": "RESTAURANT_ADMIN",
            "first_name": "Test",
            "last_name": "Owner",
            "mobile": "9999000099",
            "restaurant_name": "Duplicate Mobile Kitchen",
            "restaurant_phone": "9999000098",
            "restaurant_description": "Signup restaurant",
        }
        duplicate = self.client.post("/api/v1/auth/otp/verify/", payload, format="json")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mobile", duplicate.json()["message"])

        payload["mobile"] = "9999000097"
        verify = self.client.post("/api/v1/auth/otp/verify/", payload, format="json")
        self.assertEqual(verify.status_code, status.HTTP_200_OK, verify.json())
        self.assertEqual(verify.json()["user"]["role"], "RESTAURANT_ADMIN")

    def test_openapi_schema(self):
        self.client.credentials()
        schema = self.client.get("/api/schema/")
        self.assertEqual(schema.status_code, status.HTTP_200_OK)
