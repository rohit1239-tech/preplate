import uuid

from django.conf import settings
from django.db import models


class DeliveryLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    address = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["name", "address"], name="unique_delivery_location_name_address")
        ]

    def __str__(self):
        return self.name


class RestaurantDeliveryLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="served_locations")
    delivery_location = models.ForeignKey("delivery_locations.DeliveryLocation", on_delete=models.CASCADE, related_name="restaurant_services")
    capacity_per_slot = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["delivery_location__name"]
        constraints = [
            models.UniqueConstraint(fields=["restaurant", "delivery_location"], name="unique_restaurant_delivery_location")
        ]

    def __str__(self):
        return f"{self.restaurant} serves {self.delivery_location}"


class LocationRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="location_requests")
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.SET_NULL, null=True, blank=True, related_name="location_requests")
    name = models.CharField(max_length=120)
    address = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    matched_location = models.ForeignKey(
        "delivery_locations.DeliveryLocation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matched_requests",
    )
    matched_request = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="duplicate_requests",
    )
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="reviewed_location_requests")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_location = models.ForeignKey(
        "delivery_locations.DeliveryLocation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_requests",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.status})"
