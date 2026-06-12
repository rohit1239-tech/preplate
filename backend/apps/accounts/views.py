from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import SendOTPSerializer, UserSerializer, VerifyOTPSerializer
from apps.accounts.services import OTPAuthService


class SendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        otp = OTPAuthService.send_otp(
            serializer.validated_data["phone"],
            request.META.get("REMOTE_ADDR"),
        )
        payload = {"detail": "OTP sent."}
        if settings.DEBUG:
            payload["debug_otp"] = otp
        return Response(payload, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = OTPAuthService.verify_otp(**serializer.validated_data)
        return Response(
            {
                "access": result["access"],
                "refresh": result["refresh"],
                "user": UserSerializer(result["user"]).data,
            }
        )


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)
