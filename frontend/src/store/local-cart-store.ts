import { create } from "zustand";
import type { MenuItem, Restaurant } from "@/types";

export interface LocalCartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface LocalCartState {
  restaurant: Restaurant | null;
  items: LocalCartItem[];
  setRestaurant: (restaurant: Restaurant | null) => void;
  addItem: (restaurant: Restaurant, menuItem: MenuItem) => void;
  decrementItem: (menuItemId: string) => void;
  clear: () => void;
}

export const useLocalCartStore = create<LocalCartState>((set) => ({
  restaurant: null,
  items: [],
  setRestaurant: (restaurant) => set({ restaurant }),
  addItem: (restaurant, menuItem) =>
    set((state) => {
      const sameRestaurant = !state.restaurant || state.restaurant.id === restaurant.id;
      const items = sameRestaurant ? state.items : [];
      const existing = items.find((item) => item.menuItem.id === menuItem.id);
      return {
        restaurant,
        items: existing
          ? items.map((item) =>
              item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
            )
          : [...items, { menuItem, quantity: 1 }],
      };
    }),
  decrementItem: (menuItemId) =>
    set((state) => ({
      items: state.items
        .map((item) => (item.menuItem.id === menuItemId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    })),
  clear: () => set({ restaurant: null, items: [] }),
}));

export function getCartTotal(items: LocalCartItem[]) {
  return items.reduce((total, item) => total + Number(item.menuItem.price) * item.quantity, 0);
}
