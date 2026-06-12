from rest_framework import viewsets

from core.permissions.classes import ReadOnlyOrRestaurantOwnerOrPlatformAdmin

from apps.slots.models import DeliverySlot
from apps.slots.serializers import DeliverySlotSerializer


class DeliverySlotViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverySlotSerializer
    permission_classes = [ReadOnlyOrRestaurantOwnerOrPlatformAdmin]

    def get_queryset(self):
        qs = DeliverySlot.objects.select_related("restaurant")
        restaurant_id = self.kwargs.get("restaurant_pk") or self.request.query_params.get("restaurant")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        if not self.request.user.is_authenticated or self.request.user.role == "CUSTOMER":
            qs = qs.filter(is_active=True, restaurant__status="APPROVED", restaurant__is_active=True)
        elif self.request.user.role == "RESTAURANT_ADMIN":
            qs = qs.filter(restaurant__owner=self.request.user)
        return qs
