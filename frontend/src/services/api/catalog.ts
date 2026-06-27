import { resolveMediaUrl } from "@/lib/media";
import { apiClient } from "./client";
import type { DeliveryLocation, DeliverySlot, LocationRequest, MenuCategory, MenuItem, PaginatedResponse, RestaurantDeliveryLocation } from "@/types";

function withMenuItemImage(item: MenuItem): MenuItem {
  return { ...item, image: resolveMediaUrl(item.image) };
}

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

export async function listRestaurantDeliveryLocations(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<RestaurantDeliveryLocation>>("/restaurant-delivery-locations/", { params });
  return data;
}

export async function createRestaurantDeliveryLocation(payload: Partial<RestaurantDeliveryLocation>) {
  const { data } = await apiClient.post<RestaurantDeliveryLocation>("/restaurant-delivery-locations/", payload);
  return data;
}

export async function updateRestaurantDeliveryLocation(id: string, payload: Partial<RestaurantDeliveryLocation>) {
  const { data } = await apiClient.patch<RestaurantDeliveryLocation>(`/restaurant-delivery-locations/${id}/`, payload);
  return data;
}

export async function listLocationRequests(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<LocationRequest>>("/location-requests/", { params });
  return data;
}

export async function createLocationRequest(payload: Partial<LocationRequest>) {
  const { data } = await apiClient.post<LocationRequest>("/location-requests/", payload);
  return data;
}

export async function approveLocationRequest(id: string) {
  const { data } = await apiClient.post<LocationRequest>(`/location-requests/${id}/approve/`);
  return data;
}

export async function rejectLocationRequest(id: string) {
  const { data } = await apiClient.post<LocationRequest>(`/location-requests/${id}/reject/`);
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
  return { ...data, results: data.results.map(withMenuItemImage) };
}

export async function createMenuItem(payload: Partial<MenuItem> | FormData) {
  const { data } = await apiClient.post<MenuItem>("/menu-items/", payload);
  return withMenuItemImage(data);
}

export async function updateMenuItem(id: string, payload: Partial<MenuItem> | FormData) {
  const { data } = await apiClient.patch<MenuItem>(`/menu-items/${id}/`, payload);
  return withMenuItemImage(data);
}
