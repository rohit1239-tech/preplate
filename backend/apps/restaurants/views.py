import logging

from rest_framework import decorators, permissions, response, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.restaurants.models import Restaurant
from apps.restaurants.serializers import RestaurantSerializer
from apps.slots.services import ensure_default_slots

logger = logging.getLogger(__name__)


class RestaurantViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Restaurant.objects.select_related("owner")
        if self.request.user.is_authenticated and self.request.user.role == "PLATFORM_ADMIN":
            return qs
        if self.request.user.is_authenticated and self.request.user.role == "RESTAURANT_ADMIN":
            return qs.filter(owner=self.request.user)
        return qs.filter(status=Restaurant.Status.APPROVED, is_active=True)

    def perform_create(self, serializer):
        restaurant = serializer.save(owner=self.request.user)
        logger.info("restaurant_created", extra={"restaurant_id": str(restaurant.id), "owner_id": str(self.request.user.id), "status": restaurant.status, "has_image": bool(restaurant.image)})

    def perform_update(self, serializer):
        restaurant = self.get_object()
        if self.request.user.role == "RESTAURANT_ADMIN" and restaurant.status != Restaurant.Status.APPROVED:
            raise PermissionDenied("Your restaurant must be approved before settings can be changed.")
        restaurant = serializer.save()
        logger.info("restaurant_updated", extra={"restaurant_id": str(restaurant.id), "actor_id": str(self.request.user.id), "status": restaurant.status, "is_active": restaurant.is_active, "has_image": bool(restaurant.image)})

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        restaurant = self.get_object()
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        restaurant.status = Restaurant.Status.APPROVED
        restaurant.save(update_fields=["status", "updated_at"])
        created_slots = ensure_default_slots(restaurant, actor=request.user)
        logger.info("restaurant_approved", extra={"restaurant_id": str(restaurant.id), "actor_id": str(request.user.id), "default_slots_created": len(created_slots)})
        return response.Response(self.get_serializer(restaurant).data)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        restaurant = self.get_object()
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        restaurant.status = Restaurant.Status.REJECTED
        restaurant.save(update_fields=["status", "updated_at"])
        logger.info("restaurant_rejected", extra={"restaurant_id": str(restaurant.id), "actor_id": str(request.user.id)})
        return response.Response(self.get_serializer(restaurant).data)
