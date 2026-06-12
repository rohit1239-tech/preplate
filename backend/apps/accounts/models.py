import uuid

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class PhoneUserManager(UserManager):
    def _create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError("The phone number must be set.")
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone, password, **extra_fields)

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.PLATFORM_ADMIN)
        return self._create_user(phone, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        RESTAURANT_ADMIN = "RESTAURANT_ADMIN", "Restaurant Admin"
        PLATFORM_ADMIN = "PLATFORM_ADMIN", "Platform Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=15, unique=True)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.CUSTOMER)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []
    objects = PhoneUserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["username"],
                condition=~models.Q(username=""),
                name="unique_non_empty_username",
            )
        ]

    def __str__(self):
        return self.phone
