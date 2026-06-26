"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, KeyRound, LogIn } from "lucide-react";

import { OrderStatusBadge } from "@/components/data-display/status-badge";
import { RoleHeader } from "@/components/layout/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { listOrders, updateOrderStatus, verifyOrderPin } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { isRestaurantOperational, RestaurantOnboardingStatus } from "@/features/restaurant-admin/restaurant-status-gate";
import type { Order, OrderStatus } from "@/types";

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PLACED: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "REACHED",
};

export default function RestaurantOrdersPage() {
  const { restaurant, isRestaurantAdmin, isLoading: isRestaurantLoading } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: queryKeys.orders({ restaurant: true }),
    queryFn: () => listOrders({ page_size: 50 }),
    enabled: isRestaurantAdmin && isRestaurantOperational(restaurant),
  });
  const transition = useMutation({
    mutationFn: ({ order, status }: { order: Order; status: OrderStatus }) => updateOrderStatus(order.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
  const verify = useMutation({
    mutationFn: ({ order, pin }: { order: Order; pin: string }) => verifyOrderPin(order.id, { pin }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  if (!isRestaurantAdmin) {
    return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="max-w-md rounded-xl border border-border bg-surface p-6 text-center"><LogIn className="mx-auto size-10 text-text-muted" /><h1 className="mt-4 text-2xl font-semibold">Restaurant login required</h1><p className="mt-2 text-text-secondary">Sign in as a restaurant admin to manage orders and PIN handoff.</p><Button asChild className="mt-5"><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></div></main>;
  }
  if (isRestaurantLoading) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;
  if (!restaurant || !isRestaurantOperational(restaurant)) return <RestaurantOnboardingStatus restaurant={restaurant} />;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <RoleHeader title="Restaurant orders" description="Advance orders through the operational lifecycle." />
        <div className="grid gap-4">
          {orders.data?.results.map((order) => <OrderRow key={order.id} order={order} isUpdating={transition.isPending || verify.isPending} onTransition={(status) => transition.mutate({ order, status })} onVerify={(pin) => verify.mutate({ order, pin })} />)}
        </div>
      </div>
    </main>
  );
}

function OrderRow({ order, isUpdating, onTransition, onVerify }: { order: Order; isUpdating: boolean; onTransition: (status: OrderStatus) => void; onVerify: (pin: string) => void }) {
  const next = nextStatus[order.status];
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3"><p className="font-semibold">{order.order_number}</p><OrderStatusBadge status={order.status} /></div>
          <p className="mt-1 text-sm text-text-secondary">{order.items.length} items · PIN {order.delivery_pin} · {order.delivery_date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next ? <Button isLoading={isUpdating} onClick={() => onTransition(next)}>Mark {next.replaceAll("_", " ").toLowerCase()} <ArrowRight className="size-4" /></Button> : null}
          {order.status === "REACHED" ? <PinVerifier isUpdating={isUpdating} onVerify={onVerify} /> : null}
          {order.status === "DELIVERED" ? <div className="inline-flex items-center gap-2 rounded-md bg-success-surface px-3 py-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" /> Delivered</div> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-md border border-border bg-background px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-text-primary">{item.name}</p>
                <p className="mt-1 text-sm text-text-secondary">Qty {item.quantity} · {formatMoney(item.unit_price)} each</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-text-primary">{formatMoney(item.line_total)}</p>
            </div>
            <p className="mt-2 text-sm text-text-muted">Cooking instructions: Not provided</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PinVerifier({ isUpdating, onVerify }: { isUpdating: boolean; onVerify: (pin: string) => void }) {
  return <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onVerify(String(form.get("pin") ?? "")); }}><Input name="pin" defaultValue="4827" className="w-24" maxLength={4} inputMode="numeric" /><Button isLoading={isUpdating} type="submit" variant="secondary"><KeyRound className="size-4" /> Verify PIN</Button></form>;
}
