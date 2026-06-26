"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, MapPin, MenuSquare, Power, Settings, TrendingUp } from "lucide-react";

import { OrderStatusBadge } from "@/components/data-display/status-badge";
import { RoleHeader } from "@/components/layout/role-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { isRestaurantOperational, RestaurantOnboardingStatus } from "@/features/restaurant-admin/restaurant-status-gate";
import { getRestaurantAnalytics, listOrders } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import type { Order, OrderStatus } from "@/types";

const nav = [
  { href: "/restaurant/orders", label: "Orders", description: "Process orders and verify pickup PINs.", icon: ClipboardList },
  { href: "/restaurant/menu", label: "Menu", description: "Add items, upload photos, update availability.", icon: MenuSquare },
  { href: "/restaurant/slots", label: "Slots", description: "Manage lunch/dinner cutoff thresholds.", icon: CalendarClock },
  { href: "/restaurant/locations", label: "Locations", description: "Control served pickup points and capacity.", icon: MapPin },
  { href: "/restaurant/settings", label: "Settings", description: "Open/close restaurant and edit basics.", icon: Settings },
];

const activeStatuses: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "REACHED"];

type RestaurantAnalytics = {
  orders_today: number;
  revenue_today: string | number;
  pending_orders: number;
  orders_by_status: Array<{ status: OrderStatus; count: number }>;
};

export default function RestaurantDashboard() {
  const { restaurant, isRestaurantAdmin, isLoading: isRestaurantLoading } = useOwnedRestaurant();
  const orders = useQuery({
    queryKey: queryKeys.orders({ role: "restaurant", page_size: 50 }),
    queryFn: () => listOrders({ page_size: 50 }),
    enabled: isRestaurantAdmin && isRestaurantOperational(restaurant),
  });
  const analytics = useQuery({
    queryKey: queryKeys.analytics("restaurant"),
    queryFn: () => getRestaurantAnalytics() as Promise<RestaurantAnalytics>,
    enabled: isRestaurantAdmin && isRestaurantOperational(restaurant),
  });

  if (!isRestaurantAdmin) {
    return <main className="grid min-h-screen place-items-center bg-background px-4"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>;
  }
  if (isRestaurantLoading) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;
  if (!restaurant || !isRestaurantOperational(restaurant)) return <RestaurantOnboardingStatus restaurant={restaurant} />;

  const allOrders = orders.data?.results ?? [];
  const ongoingOrders = allOrders.filter((order) => activeStatuses.includes(order.status)).slice(0, 5);
  const activeOrderCount = allOrders.filter((order) => activeStatuses.includes(order.status)).length;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleHeader
          title="Restaurant home"
          description={`${restaurant?.name ?? "Restaurant"} operations, analytics, and management.`}
          action={<><Button asChild><Link href="/restaurant/orders"><ClipboardList className="size-4" /> Ongoing orders</Link></Button><Button asChild variant={restaurant?.is_active ? "outline" : "primary"}><Link href="/restaurant/settings"><Power className="size-4" /> Open/close</Link></Button>{restaurant ? <Badge variant={restaurant.is_active ? "success" : "warning"}>{restaurant.is_active ? "Open" : "Closed"}</Badge> : null}</>}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Orders today" value={analytics.data?.orders_today ?? 0} />
          <Kpi label="Pending orders" value={analytics.data?.pending_orders ?? 0} />
          <Kpi label="Active flow" value={activeOrderCount} />
          <Kpi label="Revenue today" value={formatMoney(analytics.data?.revenue_today ?? 0)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Ongoing orders</h2>
                <p className="mt-1 text-sm text-text-secondary">Orders that still need confirmation, preparation, delivery, or PIN handoff.</p>
              </div>
              <Button asChild variant="secondary"><Link href="/restaurant/orders">View all orders</Link></Button>
            </div>

            <div className="mt-5 grid gap-3">
              {ongoingOrders.length ? ongoingOrders.map((order) => <OngoingOrderCard key={order.id} order={order} />) : <EmptyState title="No ongoing orders" description="New placed orders will appear here immediately after checkout." />}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-warning" />
              <h2 className="text-xl font-semibold">Status mix today</h2>
            </div>
            <div className="mt-4 space-y-3">
              {analytics.data?.orders_by_status?.length ? analytics.data.orders_by_status.map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                  <span className="text-sm font-medium capitalize">{item.status.replaceAll("_", " ").toLowerCase()}</span>
                  <Badge variant="dark">{item.count}</Badge>
                </div>
              )) : <EmptyState title="No data yet" description="Today&apos;s order status counts will appear here." />}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-semibold">Restaurant management</h2>
          <p className="mt-1 text-sm text-text-secondary">Operational controls for menu, slots, locations, and settings.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md border border-border bg-background p-4 transition hover:-translate-y-0.5 hover:border-border-strong">
                <item.icon className="mb-3 size-5 text-warning" />
                <p className="font-semibold text-text-primary">{item.label}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function OngoingOrderCard({ order }: { order: Order }) {
  return (
    <Link href="/restaurant/orders" className="rounded-md border border-border bg-background p-4 transition hover:border-border-strong">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-text-primary">{order.order_number}</p><OrderStatusBadge status={order.status} /></div>
          <p className="mt-1 text-sm text-text-secondary">PIN {order.delivery_pin} · {order.delivery_date} · {formatMoney(order.total)}</p>
        </div>
        <Badge variant="neutral">{order.items.length} items</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {order.items.slice(0, 3).map((item) => <span key={item.id} className="rounded-sm bg-surface-subtle px-2 py-1 text-xs text-text-secondary">{item.quantity} x {item.name}</span>)}
      </div>
    </Link>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"><p className="text-sm text-text-secondary">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background p-6 text-center"><p className="font-semibold text-text-primary">{title}</p><p className="mt-1 text-sm text-text-secondary">{description}</p></div>;
}
