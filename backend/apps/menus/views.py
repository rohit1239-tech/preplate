import logging

from rest_framework import viewsets

from core.permissions.classes import ReadOnlyOrRestaurantOwnerOrPlatformAdmin

from apps.menus.models import MenuCategory, MenuItem
from apps.menus.serializers import MenuCategorySerializer, MenuItemSerializer

logger = logging.getLogger(__name__)


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

    def perform_create(self, serializer):
        category = serializer.save()
        logger.info(
            "menu_category_created",
            extra={
                "category_id": str(category.id),
                "restaurant_id": str(category.restaurant_id),
                "actor_id": str(self.request.user.id),
            },
        )

    def perform_update(self, serializer):
        category = serializer.save()
        logger.info(
            "menu_category_updated",
            extra={
                "category_id": str(category.id),
                "restaurant_id": str(category.restaurant_id),
                "actor_id": str(self.request.user.id),
                "is_active": category.is_active,
            },
        )


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

    def perform_create(self, serializer):
        item = serializer.save()
        logger.info(
            "menu_item_created",
            extra={
                "menu_item_id": str(item.id),
                "restaurant_id": str(item.restaurant_id),
                "actor_id": str(self.request.user.id),
                "has_image": bool(item.image),
            },
        )

    def perform_update(self, serializer):
        item = serializer.save()
        logger.info(
            "menu_item_updated",
            extra={
                "menu_item_id": str(item.id),
                "restaurant_id": str(item.restaurant_id),
                "actor_id": str(self.request.user.id),
                "is_active": item.is_active,
                "is_available": item.is_available,
                "has_image": bool(item.image),
            },
        )
