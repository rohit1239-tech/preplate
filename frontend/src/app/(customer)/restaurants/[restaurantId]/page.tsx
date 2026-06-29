"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, ShoppingBag, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MenuItemCard } from "@/features/menu/menu-item-card";
import { listMenuItems, getRestaurant, listSlots } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { getCartTotal, useLocalCartStore, useOrderContextStore } from "@/store";
import { formatMoney } from "@/lib/utils";
import { formatCountdown, formatTime, secondsUntilSlotCutoff, todayIsoDate } from "@/lib/date";
import type { DeliverySlot } from "@/types";

const SLOT_NAMES = ["Lunch", "Dinner"] as const;
const SLOT_ORDER: Record<string, number> = { Lunch: 0, Dinner: 1 };

function sortSlots(slots: DeliverySlot[]) {
  return [...slots].sort((a, b) => (SLOT_ORDER[a.name] ?? 99) - (SLOT_ORDER[b.name] ?? 99) || a.delivery_start_time.localeCompare(b.delivery_start_time));
}

export default function RestaurantMenuPage() {
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;
  const restaurant = useQuery({ queryKey: queryKeys.restaurant(restaurantId), queryFn: () => getRestaurant(restaurantId) });
  const menu = useQuery({ queryKey: queryKeys.menuItems({ restaurant: restaurantId }), queryFn: () => listMenuItems({ restaurant: restaurantId, page_size: 50 }) });
  const slots = useQuery({ queryKey: queryKeys.slots({ restaurant: restaurantId }), queryFn: () => listSlots({ restaurant: restaurantId, page_size: 50 }) });
  const { items } = useLocalCartStore();
  const { slotId, setSlot } = useOrderContextStore();
  const [now, setNow] = useState(() => new Date());
  const relevantSlots = useMemo(() => sortSlots(slots.data?.results ?? []), [slots.data?.results]);
  const selectedSlot = relevantSlots.find((slot) => slot.id === slotId);
  const deliveryDate = todayIsoDate();
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  const total = getCartTotal(items);

  useEffect(() => {
    if (slotId && !relevantSlots.some((slot) => slot.id === slotId)) setSlot(null);
  }, [relevantSlots, setSlot, slotId]);

  useEffect(() => {
    if (selectedSlot && secondsUntilSlotCutoff(deliveryDate, selectedSlot.cutoff_time, now) <= 0) setSlot(null);
  }, [deliveryDate, now, selectedSlot, setSlot]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!restaurant.data) return <main className="min-h-screen bg-background p-4">Loading restaurant...</main>;

  return (
    <main className="min-h-screen bg-background pb-28">
      <section className="relative h-72 overflow-hidden text-white">
        {restaurant.data.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Backend media URLs are dynamic.
          <img src={restaurant.data.image} alt={restaurant.data.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-surface-subtle text-text-muted">No restaurant photo</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-between px-4 py-5">
          <Link href="/restaurants" className="inline-flex w-fit items-center gap-2 rounded-md bg-black/30 px-3 py-2 text-sm font-medium backdrop-blur"><ArrowLeft className="size-4" /> Restaurants</Link>
          <div><h1 className="text-4xl font-semibold">{restaurant.data.name}</h1><p className="mt-2 max-w-xl text-white/80">{restaurant.data.description}</p><div className="mt-4 flex gap-3 text-sm"><span className="inline-flex items-center gap-1"><Star className="size-4 fill-warning text-warning" /> 4.7</span><span className="inline-flex items-center gap-1"><Clock className="size-4" /> Slot based</span></div></div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pt-5">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
          <p className="text-sm font-medium">Meal window</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SLOT_NAMES.map((name) => {
              const slot = relevantSlots.find((item) => item.name === name);
              const active = slot?.id === slotId;
              const secondsLeft = slot ? secondsUntilSlotCutoff(deliveryDate, slot.cutoff_time, now) : null;
              const closed = secondsLeft !== null && secondsLeft <= 0;
              const urgent = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 10 * 60;
              return (
                <button key={name} type="button" disabled={!slot || closed} onClick={() => slot && !closed && setSlot(slot.id)} className={`rounded-md border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-primary bg-primary text-white" : urgent ? "border-warning bg-warning-surface" : "border-border bg-surface hover:border-border-strong"}`}>
                  <span className="block font-medium">{name}</span>
                  <span className={`mt-1 block text-xs ${active ? "text-white/70" : closed ? "text-error" : urgent ? "text-warning" : "text-text-muted"}`}>{slot ? closed ? "Closed for today" : urgent ? `${formatCountdown(secondsLeft ?? 0)} left to order` : `Order before ${formatTime(slot.cutoff_time)}` : "Not available"}</span>
                </button>
              );
            })}
          </div>
          {selectedSlot ? <p className="mt-3 text-sm text-text-secondary">Order cutoff for this restaurant: <span className="font-medium text-text-primary">{formatTime(selectedSlot.cutoff_time)}</span></p> : null}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2">
        {menu.data?.results.map((item) => <MenuItemCard key={item.id} item={item} restaurant={restaurant.data} />)}
      </section>
      {totalItems ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center justify-between rounded-lg bg-primary p-3 text-white"><div><p className="font-semibold">{totalItems} items · {formatMoney(total)}</p><p className="text-xs text-white/70">{selectedSlot ? `${selectedSlot.name} selected` : "Choose a meal window before checkout"}</p></div>{selectedSlot ? <Button asChild variant="secondary"><Link href="/cart"><ShoppingBag className="size-4" /> View cart</Link></Button> : <Button variant="secondary" disabled><ShoppingBag className="size-4" /> View cart</Button>}</div></div> : null}
    </main>
  );
}
