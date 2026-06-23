"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";

import { RoleHeader } from "@/components/layout/role-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { createMenuCategory, createMenuItem, listMenuCategories, listMenuItems, updateMenuCategory, updateMenuItem } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { formatMoney } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/types";

export default function RestaurantMenuPage() {
  const { restaurant, isRestaurantAdmin } = useOwnedRestaurant();
  const queryClient = useQueryClient();

  const categories = useQuery({
    queryKey: queryKeys.menuCategories({ restaurant: restaurant?.id, admin: true }),
    queryFn: () => listMenuCategories({ restaurant: restaurant!.id, page_size: 50 }),
    enabled: !!restaurant,
  });

  const items = useQuery({
    queryKey: queryKeys.menuItems({ restaurant: restaurant?.id, admin: true }),
    queryFn: () => listMenuItems({ restaurant: restaurant!.id, page_size: 100 }),
    enabled: !!restaurant,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
    queryClient.invalidateQueries({ queryKey: ["menu-items"] });
  };

  const createCategory = useMutation({
    mutationFn: (name: string) => createMenuCategory({ restaurant: restaurant!.id, name, display_order: categories.data?.count ?? 0, is_active: true }),
    onSuccess: refresh,
  });

  const toggleCategory = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateMenuCategory(id, { is_active }),
    onSuccess: refresh,
  });

  const createItem = useMutation({ mutationFn: createMenuItem, onSuccess: refresh });
  const updateItem = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<MenuItem> | FormData }) => updateMenuItem(id, payload), onSuccess: refresh });

  if (!isRestaurantAdmin) return <Gate />;
  if (!restaurant) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;

  const categoryList = categories.data?.results ?? [];
  const itemList = items.data?.results ?? [];
  const visibleItems = itemList.filter((item) => item.is_active);
  const droppedItems = itemList.filter((item) => !item.is_active);

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <RoleHeader
          title="Menu management"
          description="Manage item photos, descriptions, pricing, availability, and dropped items."
          action={<Button asChild variant="secondary"><Link href="/restaurant/orders">Orders</Link></Button>}
        />

        <section className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Categories</h2>
                  <p className="mt-1 text-sm text-text-secondary">Group menu items for customer browsing.</p>
                </div>
                <Badge variant="neutral">{categoryList.length}</Badge>
              </div>

              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const name = String(form.get("name") ?? "").trim();
                  if (!name) return;
                  createCategory.mutate(name);
                  event.currentTarget.reset();
                }}
              >
                <Input name="name" placeholder="Meals, Combos, Drinks" />
                <Button type="submit" size="icon" isLoading={createCategory.isPending} aria-label="Add category"><Plus className="size-4" /></Button>
              </form>

              <div className="mt-4 space-y-2">
                {categoryList.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle p-3">
                    <span className="min-w-0 truncate font-medium">{category.name}</span>
                    <Button size="sm" variant={category.is_active ? "secondary" : "outline"} onClick={() => toggleCategory.mutate({ id: category.id, is_active: !category.is_active })}>
                      {category.is_active ? "Active" : "Inactive"}
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <CreateItemForm
              restaurantId={restaurant.id}
              categories={categoryList.filter((category) => category.is_active)}
              isPending={createItem.isPending}
              onSubmit={(payload) => createItem.mutateAsync(payload)}
            />
          </aside>

          <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Menu items</h2>
                <p className="mt-1 text-sm text-text-secondary">Edit photos, descriptions, pricing, availability, and active status.</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="success">{visibleItems.length} active</Badge>
                <Badge variant="neutral">{droppedItems.length} dropped</Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {visibleItems.map((item) => (
                <MenuItemEditor
                  key={item.id}
                  item={item}
                  categories={categoryList}
                  isPending={updateItem.isPending}
                  onUpdate={(payload) => updateItem.mutateAsync({ id: item.id, payload })}
                />
              ))}
            </div>

            {droppedItems.length ? (
              <div className="mt-8 border-t border-border pt-5">
                <h3 className="text-base font-semibold">Dropped items</h3>
                <div className="mt-3 grid gap-3">
                  {droppedItems.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-text-primary">{item.name}</p>
                        <p className="text-sm text-text-secondary">Hidden from customer menu.</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => updateItem.mutate({ id: item.id, payload: { is_active: true, is_available: true } })}>
                        <RefreshCw className="size-4" /> Reactivate
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function CreateItemForm({ restaurantId, categories, isPending, onSubmit }: { restaurantId: string; categories: MenuCategory[]; isPending: boolean; onSubmit: (payload: FormData) => Promise<unknown> }) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function selectImage(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setSelectedImage(file);
    setPreviewUrl(nextPreviewUrl);
  }

  function clearSelectedImage() {
    selectImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section className="rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-lg font-semibold">Add item</h2>
      <p className="mt-1 text-sm text-text-secondary">Create a new customer-visible item. Photo is optional.</p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const raw = new FormData(event.currentTarget);
          const payload = new FormData();
          payload.set("restaurant", restaurantId);
          payload.set("category", String(raw.get("category") ?? ""));
          payload.set("name", String(raw.get("name") ?? ""));
          payload.set("description", String(raw.get("description") ?? ""));
          payload.set("price", String(raw.get("price") ?? ""));
          payload.set("is_available", "true");
          payload.set("is_active", "true");
          if (selectedImage) payload.set("image", selectedImage);
          await onSubmit(payload);
          event.currentTarget.reset();
          clearSelectedImage();
        }}
      >
        <Input name="name" placeholder="Paneer rice bowl" required />
        <Input name="price" placeholder="Price" inputMode="decimal" required />
        <select name="category" required className="h-11 rounded-md border border-border bg-surface px-3 text-sm">
          <option value="">Select category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <textarea name="description" placeholder="Description" className="min-h-24 rounded-md border border-border bg-surface p-3 text-sm" />
        <div className="rounded-md border border-dashed border-border bg-background p-3">
          <div className="overflow-hidden rounded-md bg-surface-subtle">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Local object URL previews cannot use Next Image.
              <img src={previewUrl} alt="Selected item preview" className="h-36 w-full object-cover" />
            ) : (
              <div className="grid h-28 place-items-center text-sm text-text-muted">No photo selected</div>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate text-sm text-text-secondary">{selectedImage?.name ?? "Upload a JPG, PNG, or WebP photo."}</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover">
                <ImagePlus className="size-4" /> {selectedImage ? "Replace" : "Upload"}
                <input ref={fileInputRef} name="image" type="file" accept="image/*" className="sr-only" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} />
              </label>
              {selectedImage ? <Button type="button" variant="outline" onClick={clearSelectedImage}><X className="size-4" /> Clear</Button> : null}
            </div>
          </div>
        </div>
        <Button type="submit" isLoading={isPending} disabled={!categories.length}><Plus className="size-4" /> Create item</Button>
      </form>
    </section>
  );
}

function MenuItemEditor({ item, categories, isPending, onUpdate }: { item: MenuItem; categories: MenuCategory[]; isPending: boolean; onUpdate: (payload: Partial<MenuItem> | FormData) => Promise<unknown> }) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const displayImage = previewUrl ?? item.image;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function selectImage(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setSelectedImage(file);
    setPreviewUrl(nextPreviewUrl);
  }

  function clearSelectedImage() {
    selectImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form
      className="rounded-md border border-border bg-background p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const raw = new FormData(event.currentTarget);
        const payload = new FormData();
        payload.set("category", String(raw.get("category") ?? item.category));
        payload.set("name", String(raw.get("name") ?? item.name));
        payload.set("description", String(raw.get("description") ?? ""));
        payload.set("price", String(raw.get("price") ?? item.price));
        if (selectedImage) payload.set("image", selectedImage);
        await onUpdate(payload);
        clearSelectedImage();
      }}
    >
      <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)_220px]">
        <div>
          <div className="overflow-hidden rounded-md border border-border bg-surface-subtle">
            {displayImage ? <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Backend media URLs and local object URLs are dynamic. */}
              <img src={displayImage} alt={item.name} className="h-36 w-full object-cover" />
            </> : <div className="grid h-36 place-items-center text-sm text-text-muted">No photo</div>}
          </div>
          <p className="mt-2 truncate text-xs text-text-muted">{selectedImage?.name ?? (item.image ? "Current photo" : "No photo uploaded")}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input name="name" defaultValue={item.name} required />
          <Input name="price" defaultValue={item.price} inputMode="decimal" required />
          <select name="category" defaultValue={item.category} required className="h-11 rounded-md border border-border bg-surface px-3 text-sm">
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:border-border-strong">
              <ImagePlus className="size-4" /> {selectedImage ? "Replace selected" : "Replace photo"}
              <input ref={fileInputRef} name="image" type="file" accept="image/*" className="sr-only" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} />
            </label>
            {selectedImage ? <Button type="button" variant="outline" onClick={clearSelectedImage}><X className="size-4" /> Clear</Button> : null}
          </div>
          <textarea name="description" defaultValue={item.description} className="min-h-24 rounded-md border border-border bg-surface p-3 text-sm md:col-span-2" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="mb-1 flex flex-wrap gap-2">
            <Badge variant={item.is_available ? "success" : "warning"}>{item.is_available ? "Available" : "Unavailable"}</Badge>
            <Badge variant={item.is_active ? "success" : "neutral"}>{item.is_active ? "Active" : "Dropped"}</Badge>
          </div>
          <p className="text-sm font-semibold text-text-primary">{formatMoney(item.price)}</p>
          <Button type="submit" size="sm" isLoading={isPending}><Save className="size-4" /> Save edits</Button>
          <Button type="button" size="sm" variant={item.is_available ? "outline" : "secondary"} onClick={() => { void onUpdate({ is_available: !item.is_available }); }}>
            {item.is_available ? "Mark unavailable" : "Mark available"}
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => { void onUpdate({ is_active: false, is_available: false }); }}>
            <Trash2 className="size-4" /> Drop item
          </Button>
        </div>
      </div>
    </form>
  );
}

function Gate() {
  return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>;
}
