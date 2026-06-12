import { create } from "zustand";

interface UiState {
  isCartOpen: boolean;
  activeMenuCategoryId: string | null;
  setCartOpen: (open: boolean) => void;
  setActiveMenuCategory: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCartOpen: false,
  activeMenuCategoryId: null,
  setCartOpen: (isCartOpen) => set({ isCartOpen }),
  setActiveMenuCategory: (activeMenuCategoryId) => set({ activeMenuCategoryId }),
}));
