from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "PLATFORM_ADMIN")


class IsRestaurantAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "RESTAURANT_ADMIN")


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "CUSTOMER")


class ReadOnlyOrRestaurantOwnerOrPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {"RESTAURANT_ADMIN", "PLATFORM_ADMIN"}
        )

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user.role == "PLATFORM_ADMIN":
            return True
        restaurant = getattr(obj, "restaurant", obj)
        return getattr(restaurant, "owner_id", None) == request.user.id
