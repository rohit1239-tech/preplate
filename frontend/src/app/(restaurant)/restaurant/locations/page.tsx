"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixed, MapPin } from "lucide-react";

import { RoleHeader } from "@/components/layout/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { isRestaurantOperational, RestaurantOnboardingStatus } from "@/features/restaurant-admin/restaurant-status-gate";
import { createLocationRequest, createRestaurantDeliveryLocation, listDeliveryLocations, listRestaurantDeliveryLocations, updateRestaurantDeliveryLocation } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import type { DeliveryLocation, RestaurantDeliveryLocation } from "@/types";

type RequestForm = { name: string; address: string; note: string; latitude: string | null; longitude: string | null };

export default function RestaurantLocationsPage() {
  const { restaurant, isRestaurantAdmin, isLoading: isRestaurantLoading } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const [bulkCapacity, setBulkCapacity] = useState("50");
  const [requestForm, setRequestForm] = useState<RequestForm>({ name: "", address: "", note: "", latitude: null, longitude: null });
  const [geoStatus, setGeoStatus] = useState("");
  const locations = useQuery({ queryKey: queryKeys.locations({ catalog: true }), queryFn: () => listDeliveryLocations({ page_size: 100 }), enabled: isRestaurantOperational(restaurant) });
  const services = useQuery({
    queryKey: ["restaurant-delivery-locations", { restaurant: restaurant?.id, admin: true }],
    queryFn: () => listRestaurantDeliveryLocations({ restaurant: restaurant!.id, page_size: 100 }),
    enabled: isRestaurantOperational(restaurant),
  });
  const serviceMap = useMemo(() => new Map((services.data?.results ?? []).map((service) => [service.delivery_location, service])), [services.data?.results]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["restaurant-delivery-locations"] });
  const createService = useMutation({ mutationFn: (payload: Partial<RestaurantDeliveryLocation>) => createRestaurantDeliveryLocation(payload), onSuccess: refresh });
  const updateService = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<RestaurantDeliveryLocation> }) => updateRestaurantDeliveryLocation(id, payload), onSuccess: refresh });
  const requestLocation = useMutation({
    mutationFn: () => createLocationRequest({ ...requestForm, restaurant: restaurant!.id }),
    onSuccess: () => {
      setRequestForm({ name: "", address: "", note: "", latitude: null, longitude: null });
      setGeoStatus("Request submitted for platform review.");
    },
  });

  if (!isRestaurantAdmin) return <Gate />;
  if (isRestaurantLoading) return <main className="min-h-screen bg-background p-6">Loading...</main>;
  if (!restaurant || !isRestaurantOperational(restaurant)) return <RestaurantOnboardingStatus restaurant={restaurant} />;

  function saveService(location: DeliveryLocation, service: RestaurantDeliveryLocation | undefined, payload: Partial<RestaurantDeliveryLocation>) {
    if (service) {
      updateService.mutate({ id: service.id, payload });
      return;
    }
    createService.mutate({ restaurant: restaurant!.id, delivery_location: location.id, capacity_per_slot: Number(bulkCapacity) || 50, is_active: true, ...payload });
  }

  function applyBulkCapacity() {
    const capacity = Number(bulkCapacity);
    if (!capacity) return;
    (services.data?.results ?? []).forEach((service) => updateService.mutate({ id: service.id, payload: { capacity_per_slot: capacity } }));
  }

  function useGps() {
    if (!navigator.geolocation) {
      setGeoStatus("GPS is not available in this browser.");
      return;
    }
    setGeoStatus("Getting current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequestForm((current) => ({ ...current, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) }));
        setGeoStatus("GPS attached to request.");
      },
      () => setGeoStatus("GPS permission was not granted. You can still submit manually."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <RoleHeader title="Served pickup points" description="Choose platform-approved pickup points and set restaurant capacity per slot." />

        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Location catalog</h2>
              <p className="mt-1 text-sm text-text-secondary">Turn on the pickup points this restaurant can serve.</p>
            </div>
            <div className="flex gap-2">
              <Input value={bulkCapacity} onChange={(event) => setBulkCapacity(event.target.value.replace(/\D/g, ""))} className="w-28" inputMode="numeric" />
              <Button type="button" variant="secondary" onClick={applyBulkCapacity}>Apply capacity</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {locations.data?.results.map((location) => {
              const service = serviceMap.get(location.id);
              return (
                <div key={location.id} className="grid gap-3 rounded-md border border-border bg-background p-4 md:grid-cols-[1fr_130px_auto] md:items-center">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary"><MapPin className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">{location.name}</p>
                      <p className="mt-1 text-sm text-text-secondary">{location.address}</p>
                    </div>
                  </div>
                  <Input value={service?.capacity_per_slot ?? bulkCapacity} inputMode="numeric" onChange={(event) => { if (service) saveService(location, service, { capacity_per_slot: Number(event.target.value) || 1 }); }} />
                  <Button type="button" variant={service?.is_active ? "outline" : "secondary"} onClick={() => saveService(location, service, { is_active: !(service?.is_active ?? false) })}>
                    {service?.is_active ? "Serving" : "Serve"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold">Request new pickup point</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); requestLocation.mutate(); }}>
            <Input value={requestForm.name} onChange={(event) => setRequestForm((current) => ({ ...current, name: event.target.value }))} placeholder="Location name" required />
            <Input value={requestForm.address} onChange={(event) => setRequestForm((current) => ({ ...current, address: event.target.value }))} placeholder="Address or landmark" required />
            <Input value={requestForm.note} onChange={(event) => setRequestForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" className="md:col-span-2" />
            <Button type="button" variant="outline" onClick={useGps}><LocateFixed className="size-4" /> Use current GPS</Button>
            <Button type="submit" isLoading={requestLocation.isPending}>Submit request</Button>
          </form>
          {geoStatus ? <p className="mt-3 text-xs text-text-muted">{geoStatus}</p> : null}
          {requestLocation.error ? <p className="mt-3 text-sm text-error">{requestLocation.error.message}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Gate() {
  return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>;
}
