import { apiClient } from "./client";
import type { PaginatedResponse, Restaurant } from "@/types";

export async function listRestaurants(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<Restaurant>>("/restaurants/", { params });
  return data;
}

export async function getRestaurant(id: string) {
  const { data } = await apiClient.get<Restaurant>(`/restaurants/${id}/`);
  return data;
}

export async function updateRestaurant(id: string, payload: Partial<Pick<Restaurant, "name" | "description" | "phone" | "is_active">>) {
  const { data } = await apiClient.patch<Restaurant>(`/restaurants/${id}/`, payload);
  return data;
}

export async function approveRestaurant(id: string) {
  const { data } = await apiClient.post<Restaurant>(`/restaurants/${id}/approve/`);
  return data;
}

export async function rejectRestaurant(id: string) {
  const { data } = await apiClient.post<Restaurant>(`/restaurants/${id}/reject/`);
  return data;
}
