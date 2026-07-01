"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { OrderStatusBadge } from "@/components/data-display/status-badge";
import { RoleHeader } from "@/components/layout/role-header";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { listOrders } from "@/services/api";
import { queryKeys } from "@/services/query-keys";

export default function OrdersPage() {
  const orders = useQuery({
    queryKey: queryKeys.orders(),
    queryFn: () => listOrders({ page_size: 20 }),
  });
  const orderResults = orders.data?.results ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <RoleHeader title="Orders" description="Track placed meals, delivery PINs, and pickup status." />
        <div className="mt-6 space-y-3">
          {orderResults.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{order.order_number}</p>
                  <p className="text-sm text-text-secondary">
                    PIN {order.delivery_pin} · {formatMoney(order.total)}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
          ))}
        </div>

        {orderResults.length === 0 ? (
          <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-semibold">No orders yet</p>
            <Button asChild className="mt-4">
              <Link href="/restaurants">Order food</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
