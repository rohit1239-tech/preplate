from rest_framework import decorators, permissions, response, viewsets

from apps.restaurants.models import Restaurant
from apps.restaurants.serializers import RestaurantSerializer


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
        serializer.save(owner=self.request.user)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        restaurant = self.get_object()
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        restaurant.status = Restaurant.Status.APPROVED
        restaurant.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(restaurant).data)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        restaurant = self.get_object()
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        restaurant.status = Restaurant.Status.REJECTED
        restaurant.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(restaurant).data)
