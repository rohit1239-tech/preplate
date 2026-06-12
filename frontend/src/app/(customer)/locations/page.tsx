"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { locationImages, pickImage } from "@/lib/demo-assets";
import { formatDateLabel, tomorrowIsoDate } from "@/lib/date";
import { listDeliveryLocations, listSlots } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useOrderContextStore } from "@/store";

export default function LocationsPage() {
  const router = useRouter();
  const { deliveryLocationId, deliveryDate, slotId, setDeliveryLocation, setDeliveryDate, setSlot } = useOrderContextStore();
  const locations = useQuery({ queryKey: queryKeys.locations(), queryFn: () => listDeliveryLocations({ page_size: 50 }) });
  const slots = useQuery({ queryKey: queryKeys.slots(), queryFn: () => listSlots({ page_size: 50 }) });
  const selectedLocation = locations.data?.results.find((location) => location.id === deliveryLocationId);
  const relevantSlots = selectedLocation ? slots.data?.results.filter((slot) => slot.restaurant === selectedLocation.restaurant) ?? [] : slots.data?.results ?? [];

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between"><h1 className="text-3xl font-semibold">Where should we deliver?</h1><Button variant="ghost" onClick={() => router.push("/")}>Back home</Button></div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {locations.data?.results.map((location) => (
              <button key={location.id} type="button" onClick={() => setDeliveryLocation(location.id)} className={`overflow-hidden rounded-xl border text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 ${deliveryLocationId === location.id ? "border-primary bg-surface" : "border-border bg-surface"}`}>
                <div className="relative h-36"><Image src={pickImage(locationImages, location.id)} alt="" fill className="object-cover" sizes="50vw" /></div>
                <div className="p-4"><h2 className="font-semibold">{location.name}</h2><p className="mt-1 text-sm text-text-secondary">{location.address}</p><p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-muted"><MapPin className="size-3" /> {location.capacity_per_slot} meals per slot</p></div>
              </button>
            ))}
          </div>
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader><CardTitle>Pickup details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2"><span className="text-sm font-medium">Delivery date</span><input type="date" min={tomorrowIsoDate()} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3" /></label>
              <div className="space-y-2"><p className="text-sm font-medium">Slot</p><div className="grid gap-2">{relevantSlots.map((slot) => <button key={slot.id} type="button" onClick={() => setSlot(slot.id)} className={`rounded-md border px-3 py-3 text-left ${slotId === slot.id ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}><span className="block font-medium">{slot.name}</span><span className="text-xs opacity-75">Cutoff {slot.cutoff_time.slice(0,5)}</span></button>)}</div></div>
              <div className="rounded-md bg-surface-subtle p-3 text-sm text-text-secondary"><CalendarDays className="mr-2 inline size-4" /> {formatDateLabel(deliveryDate)} <Clock className="ml-2 mr-2 inline size-4" /> Choose before cutoff</div>
              <Button className="w-full" disabled={!deliveryLocationId || !slotId} onClick={() => router.push("/restaurants")}>Show restaurants <ArrowRight className="size-4" /></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
