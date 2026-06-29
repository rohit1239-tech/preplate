import { create } from "zustand";
import { todayIsoDate } from "@/lib/date";

interface OrderContextState {
  deliveryLocationId: string | null;
  deliveryDate: string;
  slotId: string | null;
  setDeliveryLocation: (id: string | null) => void;
  setDeliveryDate: (date: string) => void;
  setSlot: (id: string | null) => void;
  reset: () => void;
}

export const useOrderContextStore = create<OrderContextState>((set) => ({
  deliveryLocationId: null,
  deliveryDate: todayIsoDate(),
  slotId: null,
  setDeliveryLocation: (deliveryLocationId) => set({ deliveryLocationId }),
  setDeliveryDate: (deliveryDate) => set({ deliveryDate }),
  setSlot: (slotId) => set({ slotId }),
  reset: () => set({ deliveryLocationId: null, deliveryDate: todayIsoDate(), slotId: null }),
}));
