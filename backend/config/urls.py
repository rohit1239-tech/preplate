from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.cart.views import CartViewSet
from apps.delivery_locations.views import DeliveryLocationViewSet, LocationRequestViewSet, RestaurantDeliveryLocationViewSet
from apps.menus.views import MenuCategoryViewSet, MenuItemViewSet
from apps.notifications.views import NotificationViewSet
from apps.orders.views import OrderViewSet
from apps.restaurants.views import RestaurantViewSet
from apps.slots.views import DeliverySlotViewSet

router = DefaultRouter()
router.register("restaurants", RestaurantViewSet, basename="restaurant")
router.register("delivery-locations", DeliveryLocationViewSet, basename="delivery-location")
router.register("restaurant-delivery-locations", RestaurantDeliveryLocationViewSet, basename="restaurant-delivery-location")
router.register("location-requests", LocationRequestViewSet, basename="location-request")
router.register("slots", DeliverySlotViewSet, basename="slot")
router.register("menu-categories", MenuCategoryViewSet, basename="menu-category")
router.register("menu-items", MenuItemViewSet, basename="menu-item")
router.register("cart", CartViewSet, basename="cart")
router.register("orders", OrderViewSet, basename="order")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/analytics/", include("apps.analytics.urls")),
    path("api/v1/", include(router.urls)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif getattr(settings, "SERVE_MEDIA_FILES", False):
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]
