import { apiClient } from "./client";
import type { DeliveryLocation, DeliverySlot, MenuCategory, MenuItem, PaginatedResponse } from "@/types";

export async function listDeliveryLocations(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<DeliveryLocation>>("/delivery-locations/", { params });
  return data;
}

export async function createDeliveryLocation(payload: Partial<DeliveryLocation>) {
  const { data } = await apiClient.post<DeliveryLocation>("/delivery-locations/", payload);
  return data;
}

export async function updateDeliveryLocation(id: string, payload: Partial<DeliveryLocation>) {
  const { data } = await apiClient.patch<DeliveryLocation>(`/delivery-locations/${id}/`, payload);
  return data;
}

export async function listSlots(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<DeliverySlot>>("/slots/", { params });
  return data;
}

export async function createSlot(payload: Partial<DeliverySlot>) {
  const { data } = await apiClient.post<DeliverySlot>("/slots/", payload);
  return data;
}

export async function updateSlot(id: string, payload: Partial<DeliverySlot>) {
  const { data } = await apiClient.patch<DeliverySlot>(`/slots/${id}/`, payload);
  return data;
}

export async function listMenuCategories(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<MenuCategory>>("/menu-categories/", { params });
  return data;
}

export async function createMenuCategory(payload: Partial<MenuCategory>) {
  const { data } = await apiClient.post<MenuCategory>("/menu-categories/", payload);
  return data;
}

export async function updateMenuCategory(id: string, payload: Partial<MenuCategory>) {
  const { data } = await apiClient.patch<MenuCategory>(`/menu-categories/${id}/`, payload);
  return data;
}

export async function listMenuItems(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<MenuItem>>("/menu-items/", { params });
  return data;
}

export async function createMenuItem(payload: Partial<MenuItem> | FormData) {
  const { data } = await apiClient.post<MenuItem>("/menu-items/", payload);
  return data;
}

export async function updateMenuItem(id: string, payload: Partial<MenuItem> | FormData) {
  const { data } = await apiClient.patch<MenuItem>(`/menu-items/${id}/`, payload);
  return data;
}
