from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import MeView, ResendOTPView, SendOTPView, VerifyOTPView

urlpatterns = [
    path("otp/send/", SendOTPView.as_view(), name="otp-send"),
    path("otp/resend/", ResendOTPView.as_view(), name="otp-resend"),
    path("otp/verify/", VerifyOTPView.as_view(), name="otp-verify"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
]
