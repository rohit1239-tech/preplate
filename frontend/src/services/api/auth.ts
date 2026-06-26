import { apiClient } from "./client";
import type { OtpDeliveryResponse, SendOtpRequest, User, VerifyOtpRequest } from "@/types";

export async function sendOtp(payload: SendOtpRequest) {
  const { data } = await apiClient.post<OtpDeliveryResponse>("/auth/otp/send/", payload);
  return data;
}

export async function resendOtp(payload: SendOtpRequest) {
  const { data } = await apiClient.post<OtpDeliveryResponse>("/auth/otp/resend/", payload);
  return data;
}

export async function verifyOtp(payload: VerifyOtpRequest) {
  const { data } = await apiClient.post<{ access: string; refresh: string; user: User }>("/auth/otp/verify/", payload);
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get<User>("/auth/me/");
  return data;
}
