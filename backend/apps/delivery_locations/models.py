import uuid

from django.db import models


class DeliveryLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="delivery_locations")
    name = models.CharField(max_length=120)
    address = models.TextField()
    capacity_per_slot = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["restaurant", "name"], name="unique_location_name_per_restaurant")
        ]

    def __str__(self):
        return f"{self.restaurant} - {self.name}"
