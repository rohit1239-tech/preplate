"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { createMenuCategory, createMenuItem, listMenuCategories, listMenuItems, updateMenuCategory, updateMenuItem } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { formatMoney } from "@/lib/utils";

export default function RestaurantMenuPage() {
  const { restaurant, isRestaurantAdmin } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: queryKeys.menuCategories({ restaurant: restaurant?.id }), queryFn: () => listMenuCategories({ restaurant: restaurant!.id, page_size: 50 }), enabled: !!restaurant });
  const items = useQuery({ queryKey: queryKeys.menuItems({ restaurant: restaurant?.id, admin: true }), queryFn: () => listMenuItems({ restaurant: restaurant!.id, page_size: 50 }), enabled: !!restaurant });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["menu-categories"] }); queryClient.invalidateQueries({ queryKey: ["menu-items"] }); };
  const createCategory = useMutation({ mutationFn: (name: string) => createMenuCategory({ restaurant: restaurant!.id, name, display_order: categories.data?.count ?? 0, is_active: true }), onSuccess: refresh });
  const toggleCategory = useMutation({ mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateMenuCategory(id, { is_active }), onSuccess: refresh });
  const createItem = useMutation({ mutationFn: (payload: Record<string, unknown>) => createMenuItem(payload), onSuccess: refresh });
  const toggleItem = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateMenuItem(id, payload), onSuccess: refresh });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading...</main>;

  return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-6xl"><Header /><div className="grid gap-5 lg:grid-cols-[320px_1fr]"><section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">Categories</h2><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); createCategory.mutate(String(form.get("name") || "Meals")); event.currentTarget.reset(); }}><Input name="name" placeholder="Category name" /><Button type="submit">Add</Button></form><div className="mt-4 space-y-2">{categories.data?.results.map((category) => <div key={category.id} className="flex items-center justify-between rounded-md bg-surface-subtle p-3"><span className="font-medium">{category.name}</span><Button size="sm" variant={category.is_active ? "secondary" : "outline"} onClick={() => toggleCategory.mutate({ id: category.id, is_active: !category.is_active })}>{category.is_active ? "Active" : "Inactive"}</Button></div>)}</div></section><section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-xl font-semibold">Menu items</h2><form className="mt-4 grid gap-3 rounded-lg bg-surface-subtle p-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); createItem.mutate({ restaurant: restaurant.id, category: form.get("category"), name: form.get("name"), description: form.get("description"), price: form.get("price"), is_available: true, is_active: true }); event.currentTarget.reset(); }}><Input name="name" placeholder="Item name" /><Input name="price" placeholder="Price" inputMode="decimal" /><select name="category" required className="h-11 rounded-md border border-border bg-surface px-3">{categories.data?.results.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input name="description" placeholder="Short description" /><Button type="submit" className="md:col-span-2">Create item</Button></form><div className="mt-5 grid gap-3">{items.data?.results.map((item) => <div key={item.id} className="rounded-lg border border-border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.name} · {formatMoney(item.price)}</p><p className="text-sm text-text-secondary">{item.description}</p></div><div className="flex gap-2"><Button size="sm" variant={item.is_available ? "secondary" : "outline"} onClick={() => toggleItem.mutate({ id: item.id, payload: { is_available: !item.is_available } })}>{item.is_available ? "Available" : "Unavailable"}</Button><Button size="sm" variant={item.is_active ? "secondary" : "outline"} onClick={() => toggleItem.mutate({ id: item.id, payload: { is_active: !item.is_active } })}>{item.is_active ? "Active" : "Inactive"}</Button></div></div></div>)}</div></section></div></div></main>;
}

function Header() { return <div className="mb-5 flex items-center justify-between"><div><h1 className="text-3xl font-semibold">Menu management</h1><p className="mt-1 text-text-secondary">Create items and control availability without deleting history.</p></div><Link className="text-sm font-medium text-text-secondary" href="/restaurant/orders">Orders</Link></div>; }
function Gate() { return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>; }
