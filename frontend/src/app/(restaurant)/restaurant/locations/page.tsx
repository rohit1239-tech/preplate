"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RoleHeader } from "@/components/layout/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { createDeliveryLocation, listDeliveryLocations, updateDeliveryLocation } from "@/services/api";
import { queryKeys } from "@/services/query-keys";

export default function RestaurantLocationsPage() {
  const { restaurant, isRestaurantAdmin } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const locations = useQuery({ queryKey: queryKeys.locations({ restaurant: restaurant?.id, admin: true }), queryFn: () => listDeliveryLocations({ restaurant: restaurant!.id, page_size: 50 }), enabled: !!restaurant });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["locations"] });
  const create = useMutation({ mutationFn: (payload: Record<string, unknown>) => createDeliveryLocation(payload), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateDeliveryLocation(id, payload), onSuccess: refresh });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading...</main>;

  return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-5xl"><RoleHeader title="Delivery locations" description="Manage pickup points and per-slot capacity." /><section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">Add delivery location</h2><form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); create.mutate({ restaurant: restaurant.id, name: form.get("name"), address: form.get("address"), capacity_per_slot: Number(form.get("capacity_per_slot") || 50), is_active: true }); event.currentTarget.reset(); }}><Input name="name" placeholder="Hostel A" /><Input name="capacity_per_slot" placeholder="Capacity" inputMode="numeric" /><Input name="address" placeholder="Pickup address" className="md:col-span-2" /><Button type="submit" className="md:col-span-2">Create location</Button></form></section><section className="mt-5 grid gap-3">{locations.data?.results.map((location) => <form key={location.id} className="rounded-xl border border-border bg-surface p-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); update.mutate({ id: location.id, payload: { name: form.get("name"), address: form.get("address"), capacity_per_slot: Number(form.get("capacity_per_slot")) } }); }}><div className="grid gap-3 md:grid-cols-[1fr_120px_auto_auto]"><Input name="name" defaultValue={location.name} /><Input name="capacity_per_slot" defaultValue={location.capacity_per_slot} inputMode="numeric" /><Button type="submit" variant="secondary">Save</Button><Button type="button" variant={location.is_active ? "outline" : "secondary"} onClick={() => update.mutate({ id: location.id, payload: { is_active: !location.is_active } })}>{location.is_active ? "Active" : "Inactive"}</Button></div><Input name="address" defaultValue={location.address} className="mt-3" /></form>)}</section></div></main>;
}

function Gate() { return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>; }
