from rest_framework import viewsets

from core.permissions.classes import ReadOnlyOrRestaurantOwnerOrPlatformAdmin

from apps.menus.models import MenuCategory, MenuItem
from apps.menus.serializers import MenuCategorySerializer, MenuItemSerializer


class MenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    permission_classes = [ReadOnlyOrRestaurantOwnerOrPlatformAdmin]

    def get_queryset(self):
        qs = MenuCategory.objects.select_related("restaurant")
        restaurant_id = self.kwargs.get("restaurant_pk") or self.request.query_params.get("restaurant")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        if not self.request.user.is_authenticated or self.request.user.role == "CUSTOMER":
            qs = qs.filter(is_active=True, restaurant__status="APPROVED", restaurant__is_active=True)
        elif self.request.user.role == "RESTAURANT_ADMIN":
            qs = qs.filter(restaurant__owner=self.request.user)
        return qs


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [ReadOnlyOrRestaurantOwnerOrPlatformAdmin]

    def get_queryset(self):
        qs = MenuItem.objects.select_related("restaurant", "category")
        restaurant_id = self.kwargs.get("restaurant_pk") or self.request.query_params.get("restaurant")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        if not self.request.user.is_authenticated or self.request.user.role == "CUSTOMER":
            qs = qs.filter(is_active=True, is_available=True, restaurant__status="APPROVED", restaurant__is_active=True)
        elif self.request.user.role == "RESTAURANT_ADMIN":
            qs = qs.filter(restaurant__owner=self.request.user)
        return qs
