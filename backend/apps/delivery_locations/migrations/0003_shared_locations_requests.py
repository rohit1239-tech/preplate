# Generated for shared delivery locations and restaurant service capacity.

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_locations_to_services(apps, schema_editor):
    DeliveryLocation = apps.get_model("delivery_locations", "DeliveryLocation")
    RestaurantDeliveryLocation = apps.get_model("delivery_locations", "RestaurantDeliveryLocation")
    Cart = apps.get_model("cart", "Cart")
    Order = apps.get_model("orders", "Order")

    canonical_by_key = {}
    for location in DeliveryLocation.objects.order_by("created_at", "id"):
        key = (location.name.strip().lower(), location.address.strip().lower())
        canonical = canonical_by_key.get(key)
        if canonical is None:
            canonical_by_key[key] = location
            canonical = location
        else:
            Cart.objects.filter(delivery_location_id=location.id).update(delivery_location_id=canonical.id)
            Order.objects.filter(delivery_location_id=location.id).update(delivery_location_id=canonical.id)

        RestaurantDeliveryLocation.objects.get_or_create(
            restaurant_id=location.restaurant_id,
            delivery_location_id=canonical.id,
            defaults={
                "capacity_per_slot": location.capacity_per_slot,
                "is_active": location.is_active,
            },
        )

        if canonical.id != location.id:
            location.delete()


def reverse_locations_to_restaurant_owned(apps, schema_editor):
    DeliveryLocation = apps.get_model("delivery_locations", "DeliveryLocation")
    RestaurantDeliveryLocation = apps.get_model("delivery_locations", "RestaurantDeliveryLocation")
    for service in RestaurantDeliveryLocation.objects.select_related("delivery_location"):
        location = service.delivery_location
        if location.restaurant_id is None:
            location.restaurant_id = service.restaurant_id
            location.capacity_per_slot = service.capacity_per_slot
            location.save(update_fields=["restaurant", "capacity_per_slot", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("restaurants", "0002_restaurant_image"),
        ("delivery_locations", "0002_deliverylocation_image"),
        ("cart", "0001_initial"),
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="deliverylocation",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="deliverylocation",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.CreateModel(
            name="RestaurantDeliveryLocation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("capacity_per_slot", models.PositiveIntegerField(default=50)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("delivery_location", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="restaurant_services", to="delivery_locations.deliverylocation")),
                ("restaurant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="served_locations", to="restaurants.restaurant")),
            ],
            options={
                "ordering": ["delivery_location__name"],
            },
        ),
        migrations.CreateModel(
            name="LocationRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("address", models.TextField()),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("note", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("PENDING", "Pending"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], default="PENDING", max_length=16)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_location", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="source_requests", to="delivery_locations.deliverylocation")),
                ("matched_location", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="matched_requests", to="delivery_locations.deliverylocation")),
                ("matched_request", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="duplicate_requests", to="delivery_locations.locationrequest")),
                ("requester", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="location_requests", to=settings.AUTH_USER_MODEL)),
                ("restaurant", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="location_requests", to="restaurants.restaurant")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="reviewed_location_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="restaurantdeliverylocation",
            constraint=models.UniqueConstraint(fields=("restaurant", "delivery_location"), name="unique_restaurant_delivery_location"),
        ),
        migrations.RunPython(migrate_locations_to_services, reverse_locations_to_restaurant_owned),
        migrations.RemoveConstraint(
            model_name="deliverylocation",
            name="unique_location_name_per_restaurant",
        ),
        migrations.RemoveField(
            model_name="deliverylocation",
            name="image",
        ),
        migrations.RemoveField(
            model_name="deliverylocation",
            name="capacity_per_slot",
        ),
        migrations.RemoveField(
            model_name="deliverylocation",
            name="restaurant",
        ),
        migrations.AddConstraint(
            model_name="deliverylocation",
            constraint=models.UniqueConstraint(fields=("name", "address"), name="unique_delivery_location_name_address"),
        ),
    ]
