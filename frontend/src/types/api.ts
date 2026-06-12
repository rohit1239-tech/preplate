export interface ApiErrorPayload { code: string; message: string | Record<string, unknown>; }
export interface TokenPair { access: string; refresh: string; }
export interface SendOtpRequest { phone: string; }
export interface VerifyOtpRequest { phone: string; otp: string; role?: string; }
export interface CartInitializeRequest { restaurant_id: string; delivery_location_id: string; slot_id: string; delivery_date: string; }
export interface AddCartItemRequest { menu_item_id: string; quantity: number; }
export interface CheckoutRequest { payment_method: "UPI" | "COD"; }
export interface OrderStatusUpdateRequest { status: string; note?: string; }
export interface VerifyPinRequest { pin: string; }
