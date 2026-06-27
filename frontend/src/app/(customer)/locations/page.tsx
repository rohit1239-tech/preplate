"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, LocateFixed, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateLabel, tomorrowIsoDate } from "@/lib/date";
import { createLocationRequest, listDeliveryLocations } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useOrderContextStore } from "@/store";

type RequestForm = { name: string; address: string; note: string; latitude: string | null; longitude: string | null };

export default function LocationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { deliveryLocationId, deliveryDate, setDeliveryLocation, setDeliveryDate, setSlot } = useOrderContextStore();
  const [requestForm, setRequestForm] = useState<RequestForm>({ name: "", address: "", note: "", latitude: null, longitude: null });
  const [geoStatus, setGeoStatus] = useState("");
  const locations = useQuery({ queryKey: queryKeys.locations(), queryFn: () => listDeliveryLocations({ page_size: 50 }) });
  const selectedLocation = locations.data?.results.find((location) => location.id === deliveryLocationId);

  const requestLocation = useMutation({
    mutationFn: () => createLocationRequest(requestForm),
    onSuccess: () => {
      setRequestForm({ name: "", address: "", note: "", latitude: null, longitude: null });
      setGeoStatus("Request submitted for review.");
      queryClient.invalidateQueries({ queryKey: ["location-requests"] });
    },
  });

  function chooseLocation(locationId: string) {
    setDeliveryLocation(locationId);
    setSlot(null);
  }

  function useGps() {
    if (!navigator.geolocation) {
      setGeoStatus("GPS is not available in this browser.");
      return;
    }
    setGeoStatus("Getting current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequestForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setGeoStatus("GPS attached to request.");
      },
      () => setGeoStatus("GPS permission was not granted. You can still submit manually."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6"><h1 className="text-3xl font-semibold">Where should we deliver?</h1></div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {locations.data?.results.map((location) => (
              <button key={location.id} type="button" onClick={() => chooseLocation(location.id)} className={`rounded-lg border p-4 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 ${deliveryLocationId === location.id ? "border-primary bg-surface" : "border-border bg-surface"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary"><MapPin className="size-5" /></span>
                  <span>
                    <span className="block font-semibold text-text-primary">{location.name}</span>
                    <span className="mt-1 block text-sm leading-6 text-text-secondary">{location.address}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
            <Card>
              <CardHeader><CardTitle>Pickup details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <label className="block space-y-2"><span className="text-sm font-medium">Delivery date</span><input type="date" min={tomorrowIsoDate()} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3" /></label>
                <div className="rounded-md bg-surface-subtle p-3 text-sm text-text-secondary"><CalendarDays className="mr-2 inline size-4" /> {formatDateLabel(deliveryDate)} <span className="ml-2 font-medium text-text-primary">{selectedLocation?.name ?? "Choose pickup"}</span></div>
                <Button className="w-full" disabled={!deliveryLocationId} onClick={() => router.push("/restaurants")}>Show restaurants <ArrowRight className="size-4" /></Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Request pickup point</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); requestLocation.mutate(); }}>
                  <Input value={requestForm.name} onChange={(event) => setRequestForm((current) => ({ ...current, name: event.target.value }))} placeholder="Location name" required />
                  <Input value={requestForm.address} onChange={(event) => setRequestForm((current) => ({ ...current, address: event.target.value }))} placeholder="Address or landmark" required />
                  <Input value={requestForm.note} onChange={(event) => setRequestForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" />
                  <Button type="button" variant="outline" className="w-full" onClick={useGps}><LocateFixed className="size-4" /> Use current GPS</Button>
                  {geoStatus ? <p className="text-xs text-text-muted">{geoStatus}</p> : null}
                  {requestLocation.error ? <p className="text-sm text-error">{requestLocation.error.message}</p> : null}
                  <Button type="submit" className="w-full" isLoading={requestLocation.isPending}>Submit request</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
