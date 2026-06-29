"use client";

import Link from "next/link";
import { memo, useCallback, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, KeyRound, LogIn, XCircle } from "lucide-react";

import { OrderStatusBadge } from "@/components/data-display/status-badge";
import { RoleHeader } from "@/components/layout/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { cancellableOrderStatuses } from "@/constants/order-status";
import { formatMoney } from "@/lib/utils";
import { listOrders, updateOrderStatus, verifyOrderPin } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { isRestaurantOperational, RestaurantOnboardingStatus } from "@/features/restaurant-admin/restaurant-status-gate";
import type { Order, OrderStatus, PaginatedResponse } from "@/types";

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PLACED: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "REACHED",
};

function updateCachedOrder(orders: PaginatedResponse<Order> | undefined, updatedOrder: Order) {
  if (!orders) return orders;
  return {
    ...orders,
    results: orders.results.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
  };
}

export default function RestaurantOrdersPage() {
  const { restaurant, isRestaurantAdmin, isLoading: isRestaurantLoading } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const ordersQueryKey = queryKeys.orders({ restaurant: true });
  const orders = useQuery({
    queryKey: ordersQueryKey,
    queryFn: () => listOrders({ page_size: 50 }),
    enabled: isRestaurantAdmin && isRestaurantOperational(restaurant),
  });
  const transition = useMutation({
    mutationFn: ({ order, status, note }: { order: Order; status: OrderStatus; note?: string }) => updateOrderStatus(order.id, { status, note }),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<PaginatedResponse<Order>>(ordersQueryKey, (current) => updateCachedOrder(current, updatedOrder));
      queryClient.setQueryData(queryKeys.order(updatedOrder.id), updatedOrder);
    },
  });
  const verify = useMutation({
    mutationFn: ({ order, pin }: { order: Order; pin: string }) => verifyOrderPin(order.id, { pin }),
    onSuccess: (result) => {
      queryClient.setQueryData<PaginatedResponse<Order>>(ordersQueryKey, (current) => updateCachedOrder(current, result.order));
      queryClient.setQueryData(queryKeys.order(result.order.id), result.order);
    },
  });
  const transitionOrderId = transition.isPending ? transition.variables?.order.id : null;
  const verifyOrderId = verify.isPending ? verify.variables?.order.id : null;
  const transitionOrder = useCallback((order: Order, status: OrderStatus) => transition.mutate({ order, status }), [transition]);
  const cancelOrder = useCallback((order: Order, note: string) => transition.mutate({ order, status: "CANCELLED", note }), [transition]);
  const verifyOrder = useCallback((order: Order, pin: string) => verify.mutate({ order, pin }), [verify]);

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
          {orders.data?.results.map((order) => <OrderRow key={order.id} order={order} isUpdating={transitionOrderId === order.id || verifyOrderId === order.id} onTransition={transitionOrder} onCancel={cancelOrder} onVerify={verifyOrder} />)}
        </div>
      </div>
    </main>
  );
}

const OrderRow = memo(function OrderRow({ order, isUpdating, onTransition, onCancel, onVerify }: { order: Order; isUpdating: boolean; onTransition: (order: Order, status: OrderStatus) => void; onCancel: (order: Order, note: string) => void; onVerify: (order: Order, pin: string) => void }) {
  const next = nextStatus[order.status];
  const canCancel = cancellableOrderStatuses.includes(order.status);
  const [isCancelling, setIsCancelling] = useState(false);

  function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get("note") ?? "").trim();
    if (!note) return;
    onCancel(order, note);
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3"><p className="font-semibold">{order.order_number}</p><OrderStatusBadge status={order.status} /></div>
          <p className="mt-1 text-sm text-text-secondary">{order.items.length} items · PIN {order.delivery_pin} · {order.delivery_date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next ? <Button isLoading={isUpdating} onClick={() => onTransition(order, next)}>Mark {next.replaceAll("_", " ").toLowerCase()} <ArrowRight className="size-4" /></Button> : null}
          {canCancel && !isCancelling ? <Button variant="destructive" isLoading={isUpdating} onClick={() => setIsCancelling(true)}><XCircle className="size-4" /> Cancel order</Button> : null}
          {order.status === "REACHED" ? <PinVerifier isUpdating={isUpdating} onVerify={(pin) => onVerify(order, pin)} /> : null}
          {order.status === "DELIVERED" ? <div className="inline-flex items-center gap-2 rounded-md bg-success-surface px-3 py-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" /> Delivered</div> : null}
          {order.status === "CANCELLED" ? <div className="inline-flex items-center gap-2 rounded-md bg-error-surface px-3 py-2 text-sm font-medium text-error"><XCircle className="size-4" /> Cancelled</div> : null}
        </div>
      </div>

      {isCancelling ? (
        <form className="mt-4 rounded-md border border-error/20 bg-error-surface p-3" onSubmit={submitCancellation}>
          <label className="block text-sm font-medium text-error">Cancellation reason</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input name="note" placeholder="Example: item unavailable" required disabled={isUpdating} className="bg-surface" />
            <Button type="submit" variant="destructive" isLoading={isUpdating}>Confirm cancel</Button>
            <Button type="button" variant="outline" disabled={isUpdating} onClick={() => setIsCancelling(false)}>Keep order</Button>
          </div>
        </form>
      ) : null}

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
});

function PinVerifier({ isUpdating, onVerify }: { isUpdating: boolean; onVerify: (pin: string) => void }) {
  const [pin, setPin] = useState("");

  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(event) => { event.preventDefault(); if (pin.length === 4) onVerify(pin); }}>
      <OtpInput value={pin} onChange={setPin} length={4} disabled={isUpdating} ariaLabelPrefix="PIN digit" className="justify-start" />
      <Button isLoading={isUpdating} type="submit" variant="secondary" disabled={pin.length !== 4}><KeyRound className="size-4" /> Verify PIN</Button>
    </form>
  );
}
