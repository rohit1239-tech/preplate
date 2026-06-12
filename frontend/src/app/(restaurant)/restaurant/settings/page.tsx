"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { updateRestaurant } from "@/services/api";
import { useAuthStore } from "@/store";

export default function RestaurantSettingsPage() {
  const { restaurant, isRestaurantAdmin } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const mutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => updateRestaurant(restaurant!.id, payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["restaurants"] }) });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;

  return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-3xl"><Header title="Restaurant settings" /><section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Accepting orders</h2><p className="text-sm text-text-secondary">Uses Restaurant.is_active for MVP open/close.</p></div><Button variant={restaurant.is_active ? "destructive" : "primary"} isLoading={mutation.isPending} onClick={() => mutation.mutate({ is_active: !restaurant.is_active })}><Power className="size-4" /> {restaurant.is_active ? "Close" : "Open"}</Button></div></section><section className="mt-5 rounded-xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">Basics</h2><form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); mutation.mutate({ name: form.get("name"), description: form.get("description"), phone: form.get("phone") }); }}><Input name="name" defaultValue={restaurant.name} /><Input name="phone" defaultValue={restaurant.phone} /><textarea name="description" defaultValue={restaurant.description} className="min-h-28 rounded-md border border-border bg-surface p-3" /><Button type="submit" isLoading={mutation.isPending}>Save settings</Button></form></section><Button className="mt-5" variant="secondary" onClick={clearSession}>Logout</Button></div></main>;
}

function Header({ title }: { title: string }) { return <div className="mb-5 flex items-center justify-between"><h1 className="text-3xl font-semibold">{title}</h1><Link className="text-sm font-medium text-text-secondary" href="/restaurant/orders">Orders</Link></div>; }
function Gate() { return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>; }
