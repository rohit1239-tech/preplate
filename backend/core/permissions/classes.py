from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.restaurants.models import Restaurant


def has_approved_restaurant(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.role == "RESTAURANT_ADMIN"
        and Restaurant.objects.filter(owner=user, status=Restaurant.Status.APPROVED).exists()
    )


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "PLATFORM_ADMIN")


class IsRestaurantAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN")


class IsApprovedRestaurantAdmin(BasePermission):
    def has_permission(self, request, view):
        return has_approved_restaurant(request.user)


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "CUSTOMER")


class ReadOnlyOrRestaurantOwnerOrPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            if request.user and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN":
                return has_approved_restaurant(request.user)
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "PLATFORM_ADMIN" or has_approved_restaurant(request.user))
        )

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            if request.user and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN":
                return has_approved_restaurant(request.user)
            return True
        if request.user.role == "PLATFORM_ADMIN":
            return True
        restaurant = getattr(obj, "restaurant", obj)
        return (
            getattr(restaurant, "owner_id", None) == request.user.id
            and restaurant.status == Restaurant.Status.APPROVED
        )
