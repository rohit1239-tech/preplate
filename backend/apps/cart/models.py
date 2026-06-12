import uuid

from django.conf import settings
from django.db import models


class Cart(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        CHECKED_OUT = "CHECKED_OUT", "Checked Out"
        ABANDONED = "ABANDONED", "Abandoned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="carts")
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.PROTECT)
    delivery_location = models.ForeignKey("delivery_locations.DeliveryLocation", on_delete=models.PROTECT)
    slot = models.ForeignKey("slots.DeliverySlot", on_delete=models.PROTECT)
    delivery_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["restaurant"]),
            models.Index(fields=["delivery_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["customer"],
                condition=models.Q(status="ACTIVE"),
                name="one_active_cart_per_customer",
            )
        ]


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey("menus.MenuItem", on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cart", "menu_item"], name="unique_menu_item_per_cart")
        ]

    @property
    def line_total(self):
        return self.unit_price * self.quantity
