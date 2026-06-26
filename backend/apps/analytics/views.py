from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.restaurants.models import Restaurant


class PlatformAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "PLATFORM_ADMIN":
            self.permission_denied(request)
        today = timezone.localdate()
        today_orders = Order.objects.filter(delivery_date=today)
        return Response(
            {
                "approved_restaurants": Restaurant.objects.filter(status=Restaurant.Status.APPROVED).count(),
                "orders_today": today_orders.count(),
                "revenue_today": today_orders.aggregate(total=Sum("total"))["total"] or 0,
                "orders_by_status": list(today_orders.values("status").annotate(count=Count("id"))),
            }
        )


class RestaurantAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "RESTAURANT_ADMIN":
            self.permission_denied(request)
        if not Restaurant.objects.filter(owner=request.user, status=Restaurant.Status.APPROVED).exists():
            self.permission_denied(request, message="Your restaurant must be approved before analytics are available.")
        today = timezone.localdate()
        today_orders = Order.objects.filter(restaurant__owner=request.user, restaurant__status=Restaurant.Status.APPROVED, delivery_date=today)
        return Response(
            {
                "orders_today": today_orders.count(),
                "revenue_today": today_orders.aggregate(total=Sum("total"))["total"] or 0,
                "orders_by_status": list(today_orders.values("status").annotate(count=Count("id"))),
                "pending_orders": today_orders.filter(status=Order.Status.PLACED).count(),
            }
        )
