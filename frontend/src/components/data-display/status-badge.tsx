import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types";

const labels: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  REACHED: "Reached",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variant = status === "DELIVERED" ? "success" : status === "CANCELLED" ? "error" : status === "REACHED" ? "warning" : "neutral";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}
