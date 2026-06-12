import { apiClient } from "./client";
import type { Order, OrderStatusUpdateRequest, PaginatedResponse, VerifyPinRequest } from "@/types";

export async function listOrders(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<Order>>("/orders/", { params });
  return data;
}

export async function getOrder(id: string) {
  const { data } = await apiClient.get<Order>(`/orders/${id}/`);
  return data;
}

export async function updateOrderStatus(id: string, payload: OrderStatusUpdateRequest) {
  const { data } = await apiClient.patch<Order>(`/orders/${id}/status/`, payload);
  return data;
}

export async function verifyOrderPin(id: string, payload: VerifyPinRequest) {
  const { data } = await apiClient.post<{ verified: true; order: Order }>(`/orders/${id}/verify-pin/`, payload);
  return data;
}
