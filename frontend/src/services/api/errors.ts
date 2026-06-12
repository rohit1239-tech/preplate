import { AxiosError } from "axios";
import type { ApiErrorPayload } from "@/types";

export class ApiError extends Error {
  code: string;
  payload: ApiErrorPayload | null;
  status?: number;

  constructor(message: string, code = "ERROR", status?: number, payload: ApiErrorPayload | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as Partial<ApiErrorPayload> | undefined;
    const message = typeof payload?.message === "string" ? payload.message : error.message;
    return new ApiError(message, payload?.code ?? "HTTP_ERROR", error.response?.status, payload as ApiErrorPayload);
  }
  if (error instanceof Error) return new ApiError(error.message);
  return new ApiError("Something went wrong.");
}
