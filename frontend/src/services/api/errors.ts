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

function readablePayloadMessage(message: unknown, fallback: string) {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return fallback;

  const firstEntry = Object.entries(message as Record<string, unknown>)[0];
  if (!firstEntry) return fallback;

  const [field, value] = firstEntry;
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== "string") return fallback;

  return `${field.replaceAll("_", " ")}: ${text}`;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as Partial<ApiErrorPayload> | undefined;
    const message = readablePayloadMessage(payload?.message, error.message);
    return new ApiError(message, payload?.code ?? "HTTP_ERROR", error.response?.status, payload as ApiErrorPayload);
  }
  if (error instanceof Error) return new ApiError(error.message);
  return new ApiError("Something went wrong.");
}
