"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Utensils,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/utils";
import {
  listDeliveryLocations,
  listMenuItems,
  listRestaurantDeliveryLocations,
  listRestaurants,
  listSlots,
} from "@/services/api";
import { queryKeys } from "@/services/query-keys";

export function PreplatePreview() {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: queryKeys.locations({ preview: true }),
    queryFn: () => listDeliveryLocations({ page_size: 20 }),
  });
  const restaurantsQuery = useQuery({
    queryKey: queryKeys.restaurants({ preview: true }),
    queryFn: () => listRestaurants({ page_size: 20 }),
  });
  const serviceLocationsQuery = useQuery({
    queryKey: ["restaurant-delivery-locations", { preview: true }],
    queryFn: () => listRestaurantDeliveryLocations({ page_size: 100 }),
  });
  const slotsQuery = useQuery({
    queryKey: queryKeys.slots({ preview: true }),
    queryFn: () => listSlots({ page_size: 20 }),
  });
  const menuQuery = useQuery({
    queryKey: queryKeys.menuItems({ preview: true }),
    queryFn: () => listMenuItems({ page_size: 20 }),
  });

  const locations = locationsQuery.data?.results ?? [];
  const restaurants = restaurantsQuery.data?.results ?? [];
  const serviceLocations = serviceLocationsQuery.data?.results ?? [];
  const slots = slotsQuery.data?.results ?? [];
  const menuItems = menuQuery.data?.results ?? [];
  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? locations[0];

  const restaurantsForLocation = selectedLocation
    ? restaurants.filter((restaurant) => serviceLocations.some((service) => service.delivery_location === selectedLocation.id && service.restaurant === restaurant.id && service.is_active))
    : restaurants;

  const isLoading =
    locationsQuery.isLoading ||
    restaurantsQuery.isLoading ||
    serviceLocationsQuery.isLoading ||
    slotsQuery.isLoading ||
    menuQuery.isLoading;
  const hasBackendError =
    locationsQuery.isError ||
    restaurantsQuery.isError ||
    serviceLocationsQuery.isError ||
    slotsQuery.isError ||
    menuQuery.isError;

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid min-h-[560px] w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-14">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 text-sm font-medium text-text-secondary">
              <MapPin className="size-4" /> Fixed pickup meals, no addresses
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-text-primary sm:text-5xl">
                Scheduled meals for hostels, gates, and office parks.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
                Choose a delivery location first, then order from restaurants serving that pickup
                point. Preplate keeps meal distribution predictable for customers and operators.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={<Utensils className="size-4" />} label="Approved restaurants" value={restaurants.length} />
              <Metric icon={<MapPin className="size-4" />} label="Pickup points" value={locations.length} />
              <Metric icon={<Clock className="size-4" />} label="Active slots" value={slots.length} />
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-surface-subtle">
              <CardTitle>Customer order path</CardTitle>
              <p className="text-sm leading-6 text-text-secondary">
                Location to restaurant to menu to cart to pickup PIN
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {isLoading ? <PreviewSkeleton /> : null}
              {hasBackendError ? (
                <EmptyState
                  title="Backend is not reachable"
                  description="Start Django on port 8000 and run seed_demo to load preview data."
                />
              ) : null}
              {!isLoading && !hasBackendError ? (
                locations.length ? (
                  <>
                    <div className="grid gap-2">
                      {locations.slice(0, 4).map((location) => (
                        <button
                          key={location.id}
                          type="button"
                          onClick={() => setSelectedLocationId(location.id)}
                          className={`flex items-center justify-between rounded-md border px-3 py-3 text-left transition-colors ${
                            selectedLocation?.id === location.id
                              ? "border-primary bg-surface"
                              : "border-border bg-surface hover:bg-surface-subtle"
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-semibold text-text-primary">{location.name}</span>
                            <span className="block text-xs text-text-secondary">{location.address}</span>
                          </span>
                          <ArrowRight className="size-4 text-text-muted" />
                        </button>
                      ))}
                    </div>
                    <div className="rounded-md border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase text-text-muted">Serving this location</p>
                      <div className="mt-3 space-y-3">
                        {(restaurantsForLocation.length ? restaurantsForLocation : restaurants.slice(0, 2)).map(
                          (restaurant) => (
                            <div key={restaurant.id} className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{restaurant.name}</p>
                                <p className="line-clamp-1 text-xs text-text-secondary">{restaurant.description}</p>
                              </div>
                              <Button size="sm" variant="secondary">View menu</Button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No seeded data yet"
                    description="Run `conda run -n preplate python manage.py seed_demo` in backend."
                  />
                )
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Menu preview</CardTitle>
            <p className="text-sm text-text-secondary">Item prices are snapshotted when added to cart.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {menuItems.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary">{item.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{item.description}</p>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{formatMoney(item.price)}</p>
                </div>
                <Button className="mt-4 w-full" variant="outline">Add to cart</Button>
              </div>
            ))}
            {!menuItems.length && !isLoading ? (
              <EmptyState title="No menu items" description="Seed data to preview customer menus." />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pickup confidence</CardTitle>
            <p className="text-sm text-text-secondary">Order status and PIN collection are first-class surfaces.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-subtle p-3">
              <div>
                <p className="text-sm font-semibold">ORD-DEMO-000001</p>
                <p className="text-xs text-text-secondary">Tomorrow · Lunch</p>
              </div>
              <OrderStatusBadge status="PLACED" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {"4827".split("").map((digit, index) => (
                <div
                  key={`${digit}-${index}`}
                  className="flex h-14 items-center justify-center rounded-md border border-border bg-surface text-xl font-semibold"
                >
                  {digit}
                </div>
              ))}
            </div>
            <div className="grid gap-3 text-sm text-text-secondary">
              <InfoRow icon={<CalendarDays className="size-4" />} text="Cutoff rechecked at checkout" />
              <InfoRow icon={<ShoppingBag className="size-4" />} text="One active cart per customer" />
              <InfoRow icon={<ShieldCheck className="size-4" />} text="PIN required at pickup" />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 text-text-secondary">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
