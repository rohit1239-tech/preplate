from django.urls import path

from apps.analytics.views import PlatformAnalyticsView, RestaurantAnalyticsView

urlpatterns = [
    path("platform/", PlatformAnalyticsView.as_view(), name="platform-analytics"),
    path("restaurant/", RestaurantAnalyticsView.as_view(), name="restaurant-analytics"),
]
