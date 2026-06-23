"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, LogIn, Store, UsersRound, XCircle } from "lucide-react";

import { OrderStatusBadge } from "@/components/data-display/status-badge";
import { RoleHeader } from "@/components/layout/role-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approveRestaurant, getPlatformAnalytics, listOrders, listRestaurants, rejectRestaurant } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useAuthStore } from "@/store";
import type { Order, Restaurant } from "@/types";
import { formatMoney } from "@/lib/utils";

type PlatformAnalytics = {
  approved_restaurants: number;
  orders_today: number;
  revenue_today: string | number;
  orders_by_status: Array<{ status: string; count: number }>;
};

const restaurantStatusVariant: Record<string, "neutral" | "success" | "warning" | "error"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
};

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const restaurants = useQuery({
    queryKey: queryKeys.restaurants({ admin: true, page_size: 100 }),
    queryFn: () => listRestaurants({ page_size: 100 }),
    enabled: user?.role === "PLATFORM_ADMIN",
  });

  const orders = useQuery({
    queryKey: queryKeys.orders({ admin: true, page_size: 100 }),
    queryFn: () => listOrders({ page_size: 100 }),
    enabled: user?.role === "PLATFORM_ADMIN",
  });

  const analytics = useQuery({
    queryKey: queryKeys.analytics("platform"),
    queryFn: () => getPlatformAnalytics() as Promise<PlatformAnalytics>,
    enabled: user?.role === "PLATFORM_ADMIN",
  });

  const refreshAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    queryClient.invalidateQueries({ queryKey: ["analytics", "platform"] });
  };

  const approve = useMutation({ mutationFn: approveRestaurant, onSuccess: refreshAdminData });
  const reject = useMutation({ mutationFn: rejectRestaurant, onSuccess: refreshAdminData });

  const restaurantMap = useMemo(() => {
    return new Map((restaurants.data?.results ?? []).map((restaurant) => [restaurant.id, restaurant.name]));
  }, [restaurants.data?.results]);

  const pendingRestaurants = (restaurants.data?.results ?? []).filter((restaurant) => restaurant.status === "PENDING");
  const recentOrders = orders.data?.results ?? [];
  const isLoading = restaurants.isLoading || orders.isLoading || analytics.isLoading;

  if (user?.role !== "PLATFORM_ADMIN") {
    return <AdminGate />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleHeader title="Admin console" description="Approve restaurants, monitor today's orders, and audit recent order details." />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Approved restaurants" value={analytics.data?.approved_restaurants ?? restaurants.data?.results.filter((item) => item.status === "APPROVED").length ?? 0} icon={<Store className="size-5" />} />
          <Kpi label="Pending approvals" value={pendingRestaurants.length} icon={<Clock3 className="size-5" />} tone="warning" />
          <Kpi label="Orders today" value={analytics.data?.orders_today ?? 0} icon={<UsersRound className="size-5" />} />
          <Kpi label="Revenue today" value={formatMoney(analytics.data?.revenue_today ?? 0)} icon={<CheckCircle2 className="size-5" />} tone="success" />
        </section>

        {isLoading ? <LoadingPanel /> : null}
        {restaurants.error || orders.error || analytics.error ? <ErrorPanel message="Could not load one or more admin datasets. Check that you are logged in as platform admin." /> : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Restaurant approvals</CardTitle>
                <p className="text-sm text-text-secondary">Review pending restaurant accounts before they become visible to customers.</p>
              </div>
              <Badge variant="warning">{pendingRestaurants.length} pending</Badge>
            </CardHeader>
            <CardContent>
              {pendingRestaurants.length ? (
                <div className="space-y-3">
                  {pendingRestaurants.map((restaurant) => (
                    <RestaurantApprovalRow
                      key={restaurant.id}
                      restaurant={restaurant}
                      isApproving={approve.isPending}
                      isRejecting={reject.isPending}
                      onApprove={() => approve.mutate(restaurant.id)}
                      onReject={() => reject.mutate(restaurant.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyMessage title="No restaurants waiting" description="New restaurant signups will appear here for approval." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today by status</CardTitle>
              <p className="text-sm text-text-secondary">Current platform order distribution.</p>
            </CardHeader>
            <CardContent>
              {analytics.data?.orders_by_status?.length ? (
                <div className="space-y-3">
                  {analytics.data.orders_by_status.map((item) => (
                    <div key={item.status} className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2">
                      <span className="text-sm font-medium capitalize">{item.status.replaceAll("_", " ").toLowerCase()}</span>
                      <Badge variant="dark">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyMessage title="No orders today" description="Orders placed for today will be counted here." />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Restaurants</CardTitle>
              <p className="text-sm text-text-secondary">All restaurants visible to platform admins.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(restaurants.data?.results ?? []).map((restaurant) => <RestaurantListRow key={restaurant.id} restaurant={restaurant} />)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
              <p className="text-sm text-text-secondary">Includes item names and quantities so admin review has operational context.</p>
            </CardHeader>
            <CardContent>
              {recentOrders.length ? (
                <div className="space-y-4">
                  {recentOrders.map((order) => <OrderAdminRow key={order.id} order={order} restaurantName={restaurantMap.get(order.restaurant)} />)}
                </div>
              ) : (
                <EmptyMessage title="No orders yet" description="Customer orders will appear here after checkout." />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function AdminGate() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-sm)]">
        <LogIn className="mx-auto size-10 text-text-muted" />
        <h1 className="mt-4 text-2xl font-semibold">Platform admin login required</h1>
        <p className="mt-2 text-text-secondary">Sign in with an approved platform admin account to manage approvals and inspect platform orders.</p>
        <Button asChild className="mt-5"><Link href="/login?role=PLATFORM_ADMIN">Login as platform admin</Link></Button>
      </div>
    </main>
  );
}

function Kpi({ label, value, icon, tone = "neutral" }: { label: string; value: string | number; icon: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "bg-success-surface text-success" : tone === "warning" ? "bg-warning-surface text-warning" : "bg-surface-subtle text-text-secondary";

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">{value}</p>
        </div>
        <div className={`grid size-11 place-items-center rounded-md ${toneClass}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function RestaurantApprovalRow({ restaurant, isApproving, isRejecting, onApprove, onReject }: { restaurant: Restaurant; isApproving: boolean; isRejecting: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-text-primary">{restaurant.name}</p>
            <Badge variant="warning">Pending</Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{restaurant.description || "No description provided."}</p>
          <p className="mt-1 text-xs text-text-muted">Phone {restaurant.phone || "not set"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" isLoading={isApproving} onClick={onApprove}><CheckCircle2 className="size-4" /> Approve</Button>
          <Button size="sm" variant="destructive" isLoading={isRejecting} onClick={onReject}><XCircle className="size-4" /> Reject</Button>
        </div>
      </div>
    </div>
  );
}

function RestaurantListRow({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{restaurant.name}</p>
          <p className="mt-1 text-xs text-text-muted">{restaurant.phone || "No phone"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={restaurantStatusVariant[restaurant.status] ?? "neutral"}>{restaurant.status.toLowerCase()}</Badge>
          <Badge variant={restaurant.is_active ? "success" : "neutral"}>{restaurant.is_active ? "open" : "closed"}</Badge>
        </div>
      </div>
    </div>
  );
}

function OrderAdminRow({ order, restaurantName }: { order: Order; restaurantName?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-text-primary">{order.order_number}</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-text-secondary">{restaurantName ?? "Restaurant"} · {order.delivery_date} · PIN {order.delivery_pin}</p>
        </div>
        <p className="text-lg font-semibold text-text-primary">{formatMoney(order.total)}</p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-md bg-surface px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-text-primary">{item.name}</p>
              <p className="shrink-0 text-sm font-semibold text-text-secondary">x{item.quantity}</p>
            </div>
            <p className="mt-1 text-sm text-text-muted">{formatMoney(item.unit_price)} each · {formatMoney(item.line_total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingPanel() {
  return <div className="rounded-md border border-border bg-surface p-4 text-sm text-text-secondary">Loading platform admin data...</div>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="rounded-md border border-error bg-error-surface p-4 text-sm font-medium text-error">{message}</div>;
}

function EmptyMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-6 text-center">
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}
