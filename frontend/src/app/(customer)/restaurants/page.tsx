"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Search } from "lucide-react";

import { RestaurantCard } from "@/features/restaurants/cards";
import { listDeliveryLocations, listRestaurants } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useOrderContextStore } from "@/store";

export default function RestaurantsPage() {
  const { deliveryLocationId } = useOrderContextStore();
  const restaurants = useQuery({ queryKey: queryKeys.restaurants(), queryFn: () => listRestaurants({ page_size: 50 }) });
  const locations = useQuery({ queryKey: queryKeys.locations(), queryFn: () => listDeliveryLocations({ page_size: 50 }) });
  const selectedLocation = locations.data?.results.find((location) => location.id === deliveryLocationId);
  const visibleRestaurants = selectedLocation
    ? restaurants.data?.results.filter((restaurant) => restaurant.id === selectedLocation.restaurant) ?? []
    : restaurants.data?.results ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/locations" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-text-secondary"><ArrowLeft className="size-4" /> Change pickup</Link>
            <h1 className="text-3xl font-semibold">Restaurants near {selectedLocation?.name ?? "your pickup"}</h1>
            <p className="mt-2 text-text-secondary">Meals scheduled for fixed delivery windows. Order before cutoff.</p>
          </div>
          <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-text-muted sm:w-80"><Search className="size-4" /><span className="text-sm">Search coming soon</span></div>
        </div>
        {!deliveryLocationId ? <div className="mb-5 rounded-xl border border-warning/20 bg-warning-surface p-4 text-sm text-warning"><MapPin className="mr-2 inline size-4" /> Pick a location for the best restaurant list.</div> : null}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRestaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}
        </div>
      </div>
    </main>
  );
}
