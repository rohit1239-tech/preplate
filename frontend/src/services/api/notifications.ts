import { apiClient } from "./client";
import type { Notification, PaginatedResponse } from "@/types";

export async function listNotifications() {
  const { data } = await apiClient.get<PaginatedResponse<Notification>>("/notifications/");
  return data;
}

export async function markNotificationRead(id: string) {
  const { data } = await apiClient.post<Notification>(`/notifications/${id}/mark-read/`);
  return data;
}
