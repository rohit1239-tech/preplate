import { resolveMediaUrl } from "@/lib/media";
import { apiClient } from "./client";
import type { PaginatedResponse, Restaurant } from "@/types";

function withRestaurantImage(restaurant: Restaurant): Restaurant {
  return { ...restaurant, image: resolveMediaUrl(restaurant.image) };
}

export async function listRestaurants(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<PaginatedResponse<Restaurant>>("/restaurants/", { params });
  return { ...data, results: data.results.map(withRestaurantImage) };
}

export async function getRestaurant(id: string) {
  const { data } = await apiClient.get<Restaurant>(`/restaurants/${id}/`);
  return withRestaurantImage(data);
}

export async function updateRestaurant(id: string, payload: Partial<Pick<Restaurant, "name" | "description" | "phone" | "is_active">> | FormData) {
  const { data } = await apiClient.patch<Restaurant>(`/restaurants/${id}/`, payload);
  return withRestaurantImage(data);
}

export async function approveRestaurant(id: string) {
  const { data } = await apiClient.post<Restaurant>(`/restaurants/${id}/approve/`);
  return withRestaurantImage(data);
}

export async function rejectRestaurant(id: string) {
  const { data } = await apiClient.post<Restaurant>(`/restaurants/${id}/reject/`);
  return withRestaurantImage(data);
}
