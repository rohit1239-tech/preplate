from datetime import time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.delivery_locations.models import DeliveryLocation
from apps.menus.models import MenuCategory, MenuItem
from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.payments.models import Payment
from apps.restaurants.models import Restaurant
from apps.slots.models import DeliverySlot


class Command(BaseCommand):
    help = "Seed deterministic demo data for local MVP testing."

    def handle(self, *args, **options):
        platform_admin = self._user("platform@preplate.local", User.Role.PLATFORM_ADMIN, None)
        restaurant_owner = self._user("restaurant@preplate.local", User.Role.RESTAURANT_ADMIN, "9999990001")
        customer = self._user("customer@preplate.local", User.Role.CUSTOMER, "9999990002")

        bowl_house = self._restaurant(
            owner=restaurant_owner,
            name="Bowl House",
            phone="8888800001",
            description="Balanced rice bowls and quick campus meals.",
            status=Restaurant.Status.APPROVED,
        )
        south_street = self._restaurant(
            owner=restaurant_owner,
            name="South Street Kitchen",
            phone="8888800002",
            description="Comforting South Indian plates for predictable pickup windows.",
            status=Restaurant.Status.APPROVED,
        )
        self._restaurant(
            owner=restaurant_owner,
            name="Pending Cloud Kitchen",
            phone="8888800003",
            description="Pending approval demo restaurant.",
            status=Restaurant.Status.PENDING,
        )

        hostel_a = self._location(bowl_house, "Hostel A", "North campus, near block A", 80)
        college_gate = self._location(bowl_house, "College Gate", "Main entrance gate", 60)
        office_park = self._location(south_street, "Office Park", "Tower 2 pickup bay", 50)
        self._location(south_street, "Hostel A", "North campus, near block A", 70)

        lunch = self._slot(bowl_house, "Lunch", time(10, 30), time(12, 15), time(13, 15))
        self._slot(bowl_house, "Dinner", time(17, 30), time(19, 15), time(20, 15))
        self._slot(south_street, "Lunch", time(10, 45), time(12, 30), time(13, 30))
        self._slot(south_street, "Dinner", time(17, 45), time(19, 30), time(20, 30))

        bowls = self._category(bowl_house, "Bowls", 1)
        sides = self._category(bowl_house, "Sides", 2)
        meals = self._category(south_street, "Meals", 1)
        drinks = self._category(south_street, "Drinks", 2)

        thali = self._item(bowl_house, bowls, "Paneer Protein Bowl", "Paneer, jeera rice, salad, and house chutney.", Decimal("180.00"))
        self._item(bowl_house, bowls, "Rajma Rice Bowl", "Slow-cooked rajma with steamed rice and onion salad.", Decimal("140.00"))
        self._item(bowl_house, sides, "Masala Curd", "Cooling curd with roasted cumin.", Decimal("45.00"))
        self._item(south_street, meals, "Mini Tiffin", "Idli, dosa, pongal, vada, and sambar.", Decimal("160.00"))
        self._item(south_street, meals, "Lemon Rice Box", "Lemon rice, poriyal, pickle, and curd.", Decimal("130.00"))
        self._item(south_street, drinks, "Filter Coffee", "Fresh decoction, served hot.", Decimal("40.00"))

        order = self._order(customer, bowl_house, hostel_a, lunch)
        if not order.items.exists():
            OrderItem.objects.create(
                order=order,
                menu_item=thali,
                name=thali.name,
                quantity=1,
                unit_price=thali.price,
                line_total=thali.price,
            )
        Payment.objects.get_or_create(order=order, defaults={"method": Payment.Method.COD, "amount": order.total})
        OrderStatusHistory.objects.get_or_create(
            order=order,
            to_status=Order.Status.PLACED,
            defaults={"from_status": "", "changed_by": customer, "note": "Seeded demo order"},
        )

        self.stdout.write(self.style.SUCCESS("Seeded Preplate demo data."))
        self.stdout.write("Demo users: platform=platform@preplate.local, restaurant=restaurant@preplate.local, customer=customer@preplate.local")
        self.stdout.write("Local debug OTP is 123456 when DEBUG=True.")
        self.stdout.write(f"Created restaurants: {bowl_house.name}, {south_street.name}")
        self.stdout.write(f"Sample pickup locations: {hostel_a.name}, {college_gate.name}, {office_park.name}")

    def _user(self, email, role, phone):
        user, _ = User.objects.get_or_create(email=email, defaults={"role": role, "phone": phone})
        changed = False
        for field, value in {"role": role, "phone": phone}.items():
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed = True
        if changed:
            user.save(update_fields=["role", "phone"])
        return user

    def _restaurant(self, owner, name, phone, description, status):
        restaurant, _ = Restaurant.objects.get_or_create(
            name=name,
            defaults={"owner": owner, "phone": phone, "description": description, "status": status},
        )
        changed = False
        for field, value in {"owner": owner, "phone": phone, "description": description, "status": status, "is_active": True}.items():
            if getattr(restaurant, field) != value:
                setattr(restaurant, field, value)
                changed = True
        if changed:
            restaurant.save()
        return restaurant

    def _location(self, restaurant, name, address, capacity):
        location, _ = DeliveryLocation.objects.get_or_create(
            restaurant=restaurant,
            name=name,
            defaults={"address": address, "capacity_per_slot": capacity, "is_active": True},
        )
        location.address = address
        location.capacity_per_slot = capacity
        location.is_active = True
        location.save()
        return location

    def _slot(self, restaurant, name, cutoff, start, end):
        slot, _ = DeliverySlot.objects.get_or_create(
            restaurant=restaurant,
            name=name,
            defaults={"cutoff_time": cutoff, "delivery_start_time": start, "delivery_end_time": end, "is_active": True},
        )
        slot.cutoff_time = cutoff
        slot.delivery_start_time = start
        slot.delivery_end_time = end
        slot.is_active = True
        slot.save()
        return slot

    def _category(self, restaurant, name, order):
        category, _ = MenuCategory.objects.get_or_create(
            restaurant=restaurant,
            name=name,
            defaults={"display_order": order, "is_active": True},
        )
        category.display_order = order
        category.is_active = True
        category.save()
        return category

    def _item(self, restaurant, category, name, description, price):
        item, _ = MenuItem.objects.get_or_create(
            restaurant=restaurant,
            name=name,
            defaults={"category": category, "description": description, "price": price, "is_available": True, "is_active": True},
        )
        item.category = category
        item.description = description
        item.price = price
        item.is_available = True
        item.is_active = True
        item.save()
        return item

    def _order(self, customer, restaurant, location, slot):
        delivery_date = timezone.localdate() + timedelta(days=1)
        order, _ = Order.objects.get_or_create(
            order_number="ORD-DEMO-000001",
            defaults={
                "customer": customer,
                "restaurant": restaurant,
                "delivery_location": location,
                "slot": slot,
                "delivery_date": delivery_date,
                "status": Order.Status.PLACED,
                "delivery_pin": "4827",
                "subtotal": Decimal("180.00"),
                "discount_amount": Decimal("0.00"),
                "delivery_fee": Decimal("0.00"),
                "total": Decimal("180.00"),
            },
        )
        Order.objects.filter(pk=order.pk).update(
            customer=customer,
            restaurant=restaurant,
            delivery_location=location,
            slot=slot,
            delivery_date=delivery_date,
            status=Order.Status.PLACED,
            delivery_pin="4827",
            subtotal=Decimal("180.00"),
            discount_amount=Decimal("0.00"),
            delivery_fee=Decimal("0.00"),
            total=Decimal("180.00"),
        )
        order.refresh_from_db()
        return order
