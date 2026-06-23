"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Plus, Save } from "lucide-react";

import { RoleHeader } from "@/components/layout/role-header";
import { Badge } from "@/components/ui/badge";
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
  const slots = useQuery({
    queryKey: queryKeys.slots({ restaurant: restaurant?.id, admin: true }),
    queryFn: () => listSlots({ restaurant: restaurant!.id, page_size: 10 }),
    enabled: !!restaurant,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["slots"] });
  const create = useMutation({ mutationFn: (name: "Lunch" | "Dinner") => createSlot({ restaurant: restaurant!.id, name, ...defaults[name], is_active: true }), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateSlot(id, payload), onSuccess: refresh });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;

  const existing = new Set(slots.data?.results.map((slot) => slot.name));

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <RoleHeader title="Slot threshold management" description="Control lunch/dinner ordering cutoff and delivery windows." />

        <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Create supported slots</h2>
              <p className="mt-1 text-sm text-text-secondary">MVP supports only Lunch and Dinner. Cutoff is the order threshold time.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["Lunch", "Dinner"] as const).map((name) => (
                <Button key={name} variant={existing.has(name) ? "secondary" : "primary"} disabled={existing.has(name)} isLoading={create.isPending} onClick={() => create.mutate(name)}>
                  <Plus className="size-4" /> {existing.has(name) ? `${name} exists` : `Create ${name}`}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {slots.data?.results.map((slot) => (
            <form
              key={slot.id}
              className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                update.mutate({
                  id: slot.id,
                  payload: {
                    cutoff_time: form.get("cutoff_time"),
                    delivery_start_time: form.get("delivery_start_time"),
                    delivery_end_time: form.get("delivery_end_time"),
                  },
                });
              }}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-5 text-warning" />
                    <h2 className="text-xl font-semibold">{slot.name}</h2>
                    <Badge variant={slot.is_active ? "success" : "neutral"}>{slot.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">Customers must order before cutoff for this slot.</p>
                </div>
                <Button type="button" variant={slot.is_active ? "outline" : "secondary"} onClick={() => update.mutate({ id: slot.id, payload: { is_active: !slot.is_active } })}>
                  {slot.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <label className="space-y-1 text-sm font-medium">Order cutoff<Input name="cutoff_time" type="time" defaultValue={slot.cutoff_time.slice(0, 5)} required /></label>
                <label className="space-y-1 text-sm font-medium">Delivery starts<Input name="delivery_start_time" type="time" defaultValue={slot.delivery_start_time.slice(0, 5)} required /></label>
                <label className="space-y-1 text-sm font-medium">Delivery ends<Input name="delivery_end_time" type="time" defaultValue={slot.delivery_end_time.slice(0, 5)} required /></label>
                <Button type="submit" className="self-end" variant="secondary" isLoading={update.isPending}><Save className="size-4" /> Save threshold</Button>
              </div>
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}

function Gate() { return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>; }
