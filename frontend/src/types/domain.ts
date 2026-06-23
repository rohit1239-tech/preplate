export type UserRole = "CUSTOMER" | "RESTAURANT_ADMIN" | "PLATFORM_ADMIN";
export type CartStatus = "ACTIVE" | "CHECKED_OUT" | "ABANDONED";
export type OrderStatus = "PLACED" | "CONFIRMED" | "PREPARING" | "OUT_FOR_DELIVERY" | "REACHED" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "UPI" | "COD";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface PaginatedResponse<T> { count: number; next: string | null; previous: string | null; results: T[]; }
export interface User { id: string; email: string; phone: string | null; first_name: string; last_name: string; role: UserRole; }
export interface Restaurant { id: string; owner: string; name: string; description: string; phone: string; status: string; is_active: boolean; }
export interface DeliveryLocation { id: string; restaurant: string; name: string; address: string; capacity_per_slot: number; is_active: boolean; }
export interface DeliverySlot { id: string; restaurant: string; name: string; cutoff_time: string; delivery_start_time: string; delivery_end_time: string; is_active: boolean; }
export interface MenuCategory { id: string; restaurant: string; name: string; display_order: number; is_active: boolean; }
export interface MenuItem { id: string; restaurant: string; category: string; name: string; description: string; price: string; image: string; is_available: boolean; is_active: boolean; }
export interface CartItem { id: string; menu_item: string; quantity: number; unit_price: string; line_total: string; }
export interface Cart { id: string; customer: string; restaurant: string; delivery_location: string; slot: string; delivery_date: string; status: CartStatus; items: CartItem[]; }
export interface OrderItem { id: string; menu_item: string; name: string; quantity: number; unit_price: string; line_total: string; }
export interface Order { id: string; order_number: string; customer: string; restaurant: string; delivery_location: string; slot: string; delivery_date: string; status: OrderStatus; delivery_pin: string; delivery_pin_attempts: number; subtotal: string; discount_amount: string; delivery_fee: string; total: string; payment_status: PaymentStatus; items: OrderItem[]; created_at: string; updated_at: string; }
export interface Notification { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; }
