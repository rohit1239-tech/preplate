"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { createSlot, listSlots, updateSlot } from "@/services/api";
import { queryKeys } from "@/services/query-keys";

const defaults = {
  Lunch: { cutoff_time: "10:30", delivery_start_time: "12:15", delivery_end_time: "13:15" },
  Dinner: { cutoff_time: "17:30", delivery_start_time: "19:15", delivery_end_time: "20:15" },
};

export default function RestaurantSlotsPage() {
  const { restaurant, isRestaurantAdmin } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const slots = useQuery({ queryKey: queryKeys.slots({ restaurant: restaurant?.id, admin: true }), queryFn: () => listSlots({ restaurant: restaurant!.id, page_size: 10 }), enabled: !!restaurant });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["slots"] });
  const create = useMutation({ mutationFn: (name: "Lunch" | "Dinner") => createSlot({ restaurant: restaurant!.id, name, ...defaults[name], is_active: true }), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateSlot(id, payload), onSuccess: refresh });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading...</main>;
  const existing = new Set(slots.data?.results.map((slot) => slot.name));

  return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-4xl"><Header /><div className="mb-5 flex gap-2">{(["Lunch", "Dinner"] as const).map((name) => <Button key={name} disabled={existing.has(name)} onClick={() => create.mutate(name)}>{existing.has(name) ? `${name} exists` : `Create ${name}`}</Button>)}</div><div className="grid gap-4">{slots.data?.results.map((slot) => <form key={slot.id} className="rounded-xl border border-border bg-surface p-5" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); update.mutate({ id: slot.id, payload: { cutoff_time: form.get("cutoff_time"), delivery_start_time: form.get("delivery_start_time"), delivery_end_time: form.get("delivery_end_time") } }); }}><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{slot.name}</h2><Button type="button" variant={slot.is_active ? "outline" : "secondary"} onClick={() => update.mutate({ id: slot.id, payload: { is_active: !slot.is_active } })}>{slot.is_active ? "Active" : "Inactive"}</Button></div><div className="grid gap-3 sm:grid-cols-4"><label className="space-y-1 text-sm font-medium">Cutoff<Input name="cutoff_time" type="time" defaultValue={slot.cutoff_time.slice(0,5)} /></label><label className="space-y-1 text-sm font-medium">Start<Input name="delivery_start_time" type="time" defaultValue={slot.delivery_start_time.slice(0,5)} /></label><label className="space-y-1 text-sm font-medium">End<Input name="delivery_end_time" type="time" defaultValue={slot.delivery_end_time.slice(0,5)} /></label><Button type="submit" className="self-end" variant="secondary">Save timing</Button></div></form>)}</div></div></main>;
}

function Header() { return <div className="mb-5 flex items-center justify-between"><div><h1 className="text-3xl font-semibold">Lunch and Dinner slots</h1><p className="mt-1 text-text-secondary">Slots are limited to Lunch/Dinner; edit cutoff and delivery windows.</p></div><Link className="text-sm font-medium text-text-secondary" href="/restaurant/orders">Orders</Link></div>; }
function Gate() { return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>; }
