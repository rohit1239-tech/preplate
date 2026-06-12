import type { UserRole } from "@/types";

export function normalizeRole(value: unknown): UserRole {
  return value === "RESTAURANT_ADMIN" || value === "PLATFORM_ADMIN" || value === "CUSTOMER" ? value : "CUSTOMER";
}
