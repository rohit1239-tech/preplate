export const queryKeys = {
  me: ["me"] as const,
  restaurants: (params?: unknown) => ["restaurants", params] as const,
  restaurant: (id: string) => ["restaurants", id] as const,
  locations: (params?: unknown) => ["locations", params] as const,
  slots: (params?: unknown) => ["slots", params] as const,
  menuCategories: (params?: unknown) => ["menu-categories", params] as const,
  menuItems: (params?: unknown) => ["menu-items", params] as const,
  cart: ["cart", "active"] as const,
  orders: (params?: unknown) => ["orders", params] as const,
  order: (id: string) => ["orders", id] as const,
  notifications: ["notifications"] as const,
  analytics: (scope: "restaurant" | "platform") => ["analytics", scope] as const,
};
