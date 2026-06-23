"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Power, Save } from "lucide-react";

import { RoleHeader } from "@/components/layout/role-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { updateRestaurant } from "@/services/api";

export default function RestaurantSettingsPage() {
  const { restaurant, isRestaurantAdmin } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateRestaurant(restaurant!.id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
  });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <RoleHeader title="Restaurant settings" description="Open/close and maintain customer-facing restaurant details." />

        <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">Restaurant availability</h2>
                <Badge variant={restaurant.is_active ? "success" : "warning"}>{restaurant.is_active ? "Open" : "Closed"}</Badge>
              </div>
              <p className="mt-1 text-sm text-text-secondary">This controls whether customers can see and order from the restaurant.</p>
            </div>
            <Button variant={restaurant.is_active ? "destructive" : "primary"} isLoading={mutation.isPending} onClick={() => mutation.mutate({ is_active: !restaurant.is_active })}>
              <Power className="size-4" /> {restaurant.is_active ? "Close restaurant" : "Open restaurant"}
            </Button>
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-semibold">Restaurant basics</h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              mutation.mutate({ name: form.get("name"), description: form.get("description"), phone: form.get("phone") });
            }}
          >
            <label className="space-y-1 text-sm font-medium">Name<Input name="name" defaultValue={restaurant.name} required /></label>
            <label className="space-y-1 text-sm font-medium">Phone<Input name="phone" defaultValue={restaurant.phone} inputMode="tel" /></label>
            <label className="space-y-1 text-sm font-medium">Description<textarea name="description" defaultValue={restaurant.description} className="min-h-28 w-full rounded-md border border-border bg-surface p-3 text-sm" /></label>
            <Button type="submit" isLoading={mutation.isPending}><Save className="size-4" /> Save settings</Button>
          </form>
        </section>

      </div>
    </main>
  );
}

function Gate() { return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>; }
