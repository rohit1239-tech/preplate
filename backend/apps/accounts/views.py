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
            serializer.validated_data["email"],
            serializer.validated_data["role"],
            request.META.get("REMOTE_ADDR"),
            serializer.validated_data["intent"],
        )
        payload = {
            "detail": "OTP sent.",
            "cooldown_seconds": OTPAuthService._cooldown_seconds(),
            "remaining_resends": OTPAuthService._max_resends(),
        }
        if settings.DEBUG:
            payload["debug_otp"] = otp
        return Response(payload, status=status.HTTP_200_OK)


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            delivery = OTPAuthService.resend_otp(
                serializer.validated_data["email"],
                serializer.validated_data["role"],
                serializer.validated_data["intent"],
            )
        except OTPAuthService.ResendCooldownError as exc:
            return Response(
                {
                    "message": "Please wait before requesting another OTP.",
                    "retry_after": exc.retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except OTPAuthService.ResendLimitError:
            return Response(
                {"message": "Maximum OTP resend attempts reached."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        payload = {
            "message": "OTP sent successfully.",
            "cooldown_seconds": delivery.cooldown_seconds,
            "remaining_resends": delivery.remaining_resends,
        }
        if settings.DEBUG:
            payload["debug_otp"] = delivery.otp
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
