import uuid

from django.db import models


class DeliverySlot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="slots")
    name = models.CharField(max_length=80)
    cutoff_time = models.TimeField()
    delivery_start_time = models.TimeField()
    delivery_end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["delivery_start_time"]
        constraints = [
            models.UniqueConstraint(fields=["restaurant", "name"], name="unique_slot_name_per_restaurant")
        ]

    def __str__(self):
        return f"{self.restaurant} - {self.name}"
