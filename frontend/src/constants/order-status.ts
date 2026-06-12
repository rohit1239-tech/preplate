import type { OrderStatus } from "@/types";

export const orderStatusSequence: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "REACHED",
  "DELIVERED",
];

export const cancellableOrderStatuses: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING"];
