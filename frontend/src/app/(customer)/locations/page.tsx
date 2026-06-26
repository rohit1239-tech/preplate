"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateLabel, formatTime, tomorrowIsoDate } from "@/lib/date";
import { listDeliveryLocations, listSlots } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { useOrderContextStore } from "@/store";
import type { DeliverySlot } from "@/types";

const SLOT_NAMES = ["Lunch", "Dinner"] as const;
type SlotName = (typeof SLOT_NAMES)[number];
const SLOT_ORDER: Record<string, number> = { Lunch: 0, Dinner: 1 };

function sortSlots(slots: DeliverySlot[]) {
  return [...slots].sort((a, b) => (SLOT_ORDER[a.name] ?? 99) - (SLOT_ORDER[b.name] ?? 99) || a.delivery_start_time.localeCompare(b.delivery_start_time));
}

export default function LocationsPage() {
  const router = useRouter();
  const { deliveryLocationId, deliveryDate, slotId, setDeliveryLocation, setDeliveryDate, setSlot } = useOrderContextStore();
  const [selectedMealWindow, setSelectedMealWindow] = useState<SlotName | null>(null);
  const locations = useQuery({ queryKey: queryKeys.locations(), queryFn: () => listDeliveryLocations({ page_size: 50 }) });
  const selectedLocation = locations.data?.results.find((location) => location.id === deliveryLocationId);
  const slots = useQuery({
    queryKey: queryKeys.slots({ restaurant: selectedLocation?.restaurant }),
    queryFn: () => listSlots({ restaurant: selectedLocation!.restaurant, page_size: 50 }),
    enabled: Boolean(selectedLocation),
  });
  const relevantSlots = useMemo(() => sortSlots(slots.data?.results ?? []), [slots.data?.results]);
  const selectedSlot = relevantSlots.find((slot) => slot.id === slotId);

  const effectiveMealWindow = selectedMealWindow ?? (selectedSlot && SLOT_NAMES.includes(selectedSlot.name as SlotName) ? (selectedSlot.name as SlotName) : null);

  useEffect(() => {
    if (slots.isLoading || slots.isFetching) return;
    if (!effectiveMealWindow) {
      if (slotId && !selectedSlot) setSlot(null);
      return;
    }

    const matchingSlot = relevantSlots.find((slot) => slot.name === effectiveMealWindow);
    if (matchingSlot && slotId !== matchingSlot.id) {
      setSlot(matchingSlot.id);
      return;
    }
    if (!matchingSlot && slotId) setSlot(null);
  }, [effectiveMealWindow, relevantSlots, selectedSlot, setSlot, slotId, slots.isFetching, slots.isLoading]);

  function chooseLocation(locationId: string) {
    if (!selectedMealWindow && selectedSlot && SLOT_NAMES.includes(selectedSlot.name as SlotName)) {
      setSelectedMealWindow(selectedSlot.name as SlotName);
    }
    setDeliveryLocation(locationId);
  }

  function chooseSlot(name: SlotName) {
    setSelectedMealWindow(name);
    const slot = relevantSlots.find((item) => item.name === name);
    setSlot(slot?.id ?? null);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6"><h1 className="text-3xl font-semibold">Where should we deliver?</h1></div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {locations.data?.results.map((location) => (
              <button key={location.id} type="button" onClick={() => chooseLocation(location.id)} className={`overflow-hidden rounded-xl border text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 ${deliveryLocationId === location.id ? "border-primary bg-surface" : "border-border bg-surface"}`}>
                <div className="h-36 overflow-hidden bg-surface-subtle">
                  {location.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Backend media URLs are dynamic.
                    <img src={location.image} alt={location.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm font-medium text-text-muted">No location photo</div>
                  )}
                </div>
                <div className="p-4"><h2 className="font-semibold">{location.name}</h2><p className="mt-1 text-sm text-text-secondary">{location.address}</p><p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-muted"><MapPin className="size-3" /> {location.capacity_per_slot} meals per slot</p></div>
              </button>
            ))}
          </div>
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader><CardTitle>Pickup details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2"><span className="text-sm font-medium">Delivery date</span><input type="date" min={tomorrowIsoDate()} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="h-11 w-full rounded-md border border-border bg-surface px-3" /></label>
              <div className="space-y-2">
                <p className="text-sm font-medium">Meal window</p>
                <div className="grid grid-cols-2 gap-2">
                  {SLOT_NAMES.map((name) => {
                    const slot = relevantSlots.find((item) => item.name === name);
                    const active = effectiveMealWindow === name && slotId === slot?.id;
                    return (
                      <button
                        key={name}
                        type="button"
                        disabled={!selectedLocation || !slot}
                        onClick={() => chooseSlot(name)}
                        className={`rounded-md border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-primary bg-primary text-white" : "border-border bg-surface hover:border-border-strong"}`}
                      >
                        <span className="block font-medium">{name}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedSlot ? <p className="text-sm text-text-secondary">Order cutoff for this restaurant: <span className="font-medium text-text-primary">{formatTime(selectedSlot.cutoff_time)}</span></p> : null}
                {selectedLocation && !slots.isLoading && relevantSlots.length === 0 ? <p className="text-sm text-text-muted">No active slots for this restaurant.</p> : null}
              </div>
              <div className="rounded-md bg-surface-subtle p-3 text-sm text-text-secondary"><CalendarDays className="mr-2 inline size-4" /> {formatDateLabel(deliveryDate)} <Clock className="ml-2 mr-2 inline size-4" /> {selectedSlot?.name ?? "Choose lunch or dinner"}</div>
              <Button className="w-full" disabled={!deliveryLocationId || !selectedSlot} onClick={() => router.push("/restaurants")}>Show restaurants <ArrowRight className="size-4" /></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
