import { apiClient } from "./client";
import type { AddCartItemRequest, Cart, CartInitializeRequest, CheckoutRequest, Order } from "@/types";

export async function getActiveCart() {
  const { data } = await apiClient.get<Cart | null>("/cart/");
  return data;
}

export async function initializeCart(payload: CartInitializeRequest) {
  const { data } = await apiClient.post<Cart>("/cart/", payload);
  return data;
}

export async function addCartItem(cartId: string, payload: AddCartItemRequest) {
  const { data } = await apiClient.post<Cart>(`/cart/${cartId}/items/`, payload);
  return data;
}

export async function checkoutCart(cartId: string, payload: CheckoutRequest) {
  const { data } = await apiClient.post<Order>(`/cart/${cartId}/checkout/`, payload);
  return data;
}
