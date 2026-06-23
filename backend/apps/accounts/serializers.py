import re

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import User

MOBILE_RE = re.compile(r"^[6-9]\d{9}$")


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "phone", "first_name", "last_name", "role")
        read_only_fields = fields


class SendOTPSerializer(serializers.Serializer):
    class Intent:
        LOGIN = "LOGIN"
        SIGNUP = "SIGNUP"

    INTENT_CHOICES = (
        (Intent.LOGIN, "Login"),
        (Intent.SIGNUP, "Signup"),
    )

    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.CUSTOMER)
    intent = serializers.ChoiceField(choices=INTENT_CHOICES, default=Intent.LOGIN)

    def validate_email(self, value):
        return value.lower()

    def validate(self, attrs):
        email = attrs["email"]
        role = attrs["role"]
        intent = attrs["intent"]
        user = User.objects.filter(email=email).first()

        if role == User.Role.PLATFORM_ADMIN and (not user or user.role != User.Role.PLATFORM_ADMIN):
            raise PermissionDenied("Platform admin access is restricted to backend-created admin accounts.")

        if intent == self.Intent.LOGIN:
            if not user:
                raise serializers.ValidationError({"email": "No account found for this email. Create an account first."})
            if user.role != role:
                raise serializers.ValidationError({"email": "This email is registered with a different role."})

        if intent == self.Intent.SIGNUP:
            if role == User.Role.PLATFORM_ADMIN:
                raise PermissionDenied("Platform admin accounts are created by backend administration only.")
            if user:
                if user.role == role:
                    raise serializers.ValidationError({"email": "An account already exists for this email. Sign in instead."})
                raise serializers.ValidationError({"email": "This email is registered with a different role."})

        return attrs


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.CUSTOMER)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    mobile = serializers.CharField(max_length=10, required=False, allow_blank=True)
    restaurant_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    restaurant_phone = serializers.CharField(max_length=10, required=False, allow_blank=True)
    restaurant_description = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        return value.lower()

    def validate(self, attrs):
        role = attrs.get("role")
        email = attrs.get("email")
        user_exists = User.objects.filter(email=email).exists()

        if role in {User.Role.CUSTOMER, User.Role.RESTAURANT_ADMIN} and not user_exists:
            required = ["first_name", "last_name", "mobile"]
            missing = [field for field in required if not str(attrs.get(field, "")).strip()]
            if missing:
                raise serializers.ValidationError({field: "This field is required for first signup." for field in missing})
            mobile = str(attrs.get("mobile", ""))
            if not MOBILE_RE.match(mobile):
                raise serializers.ValidationError({"mobile": "Enter a valid 10 digit Indian mobile number."})
            if User.objects.filter(phone=mobile).exists():
                raise serializers.ValidationError({"mobile": "This mobile number is already registered."})

        if role == User.Role.RESTAURANT_ADMIN and not user_exists:
            required = ["restaurant_name", "restaurant_phone", "restaurant_description"]
            missing = [field for field in required if not str(attrs.get(field, "")).strip()]
            if missing:
                raise serializers.ValidationError({field: "This field is required for restaurant onboarding." for field in missing})
            if not MOBILE_RE.match(str(attrs.get("restaurant_phone", ""))):
                raise serializers.ValidationError({"restaurant_phone": "Enter a valid 10 digit restaurant contact number."})

        return attrs
