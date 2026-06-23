import logging

from rest_framework import viewsets

from core.permissions.classes import ReadOnlyOrRestaurantOwnerOrPlatformAdmin

from apps.delivery_locations.models import DeliveryLocation
from apps.delivery_locations.serializers import DeliveryLocationSerializer

logger = logging.getLogger(__name__)


class DeliveryLocationViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryLocationSerializer
    permission_classes = [ReadOnlyOrRestaurantOwnerOrPlatformAdmin]

    def get_queryset(self):
        qs = DeliveryLocation.objects.select_related("restaurant")
        restaurant_id = self.kwargs.get("restaurant_pk") or self.request.query_params.get("restaurant")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        if not self.request.user.is_authenticated or self.request.user.role == "CUSTOMER":
            qs = qs.filter(is_active=True, restaurant__status="APPROVED", restaurant__is_active=True)
        elif self.request.user.role == "RESTAURANT_ADMIN":
            qs = qs.filter(restaurant__owner=self.request.user)
        return qs

    def perform_create(self, serializer):
        location = serializer.save()
        logger.info(
            "delivery_location_created",
            extra={
                "delivery_location_id": str(location.id),
                "restaurant_id": str(location.restaurant_id),
                "actor_id": str(self.request.user.id),
                "is_active": location.is_active,
            },
        )

    def perform_update(self, serializer):
        location = serializer.save()
        logger.info(
            "delivery_location_updated",
            extra={
                "delivery_location_id": str(location.id),
                "restaurant_id": str(location.restaurant_id),
                "actor_id": str(self.request.user.id),
                "is_active": location.is_active,
                "capacity_per_slot": location.capacity_per_slot,
            },
        )
