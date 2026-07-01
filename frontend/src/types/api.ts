import type { PaymentMethod, UserRole } from "./domain";

export interface ApiErrorPayload {
  code?: string;
  message: string | Record<string, unknown>;
  retry_after?: number;
}

export type AuthIntent = "LOGIN" | "SIGNUP";

export interface SendOtpRequest {
  email: string;
  role: UserRole;
  intent: AuthIntent;
}

export interface OtpDeliveryResponse {
  detail?: string;
  message?: string;
  cooldown_seconds: number;
  remaining_resends: number;
  debug_otp?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
  role?: UserRole;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  restaurant_name?: string;
  restaurant_phone?: string;
  restaurant_description?: string;
}

export interface CartInitializeRequest {
  restaurant_id: string;
  delivery_location_id: string;
  slot_id: string;
  delivery_date: string;
}

export interface AddCartItemRequest {
  menu_item_id: string;
  quantity: number;
}

export interface CheckoutRequest {
  payment_method: PaymentMethod;
}

export interface OrderStatusUpdateRequest {
  status: string;
  note?: string;
}

export interface VerifyPinRequest {
  pin: string;
}
