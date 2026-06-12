import { apiClient } from "./client";
import type { SendOtpRequest, User, VerifyOtpRequest } from "@/types";

export async function sendOtp(payload: SendOtpRequest) {
  const { data } = await apiClient.post<{ detail: string; debug_otp?: string }>("/auth/otp/send/", payload);
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
