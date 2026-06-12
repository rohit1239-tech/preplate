import { apiClient } from "./client";

export async function getRestaurantAnalytics() {
  const { data } = await apiClient.get<Record<string, unknown>>("/analytics/restaurant/");
  return data;
}

export async function getPlatformAnalytics() {
  const { data } = await apiClient.get<Record<string, unknown>>("/analytics/platform/");
  return data;
}
