"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";

import { RoleHeader } from "@/components/layout/role-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { isRestaurantOperational, RestaurantOnboardingStatus } from "@/features/restaurant-admin/restaurant-status-gate";
import { createDeliveryLocation, listDeliveryLocations, updateDeliveryLocation } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import type { DeliveryLocation } from "@/types";

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

export default function RestaurantLocationsPage() {
  const { restaurant, isRestaurantAdmin, isLoading: isRestaurantLoading } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const [createImage, setCreateImage] = useState<File | null>(null);
  const createFileRef = useRef<HTMLInputElement | null>(null);
  const locations = useQuery({
    queryKey: queryKeys.locations({ restaurant: restaurant?.id, admin: true }),
    queryFn: () => listDeliveryLocations({ restaurant: restaurant!.id, page_size: 50 }),
    enabled: isRestaurantOperational(restaurant),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["locations"] });
  const create = useMutation({ mutationFn: (payload: FormData) => createDeliveryLocation(payload), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: FormData | Record<string, unknown> }) => updateDeliveryLocation(id, payload), onSuccess: refresh });
  const createPreviewUrl = useObjectUrl(createImage);

  if (!isRestaurantAdmin) return <Gate />;
  if (isRestaurantLoading) return <main className="min-h-screen bg-background p-6">Loading...</main>;
  if (!restaurant || !isRestaurantOperational(restaurant)) return <RestaurantOnboardingStatus restaurant={restaurant} />;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <RoleHeader title="Delivery locations" description="Manage pickup points, photos, and per-slot capacity." />
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold">Add delivery location</h2>
          <form
            className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              form.set("restaurant", restaurant.id);
              form.set("is_active", "true");
              if (!createImage) form.delete("image");
              create.mutate(form, {
                onSuccess: () => {
                  event.currentTarget.reset();
                  setCreateImage(null);
                },
              });
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="name" placeholder="Hostel A" required />
              <Input name="capacity_per_slot" placeholder="Capacity" inputMode="numeric" defaultValue={50} required />
              <Input name="address" placeholder="Pickup address" className="md:col-span-2" required />
            </div>
            <div className="overflow-hidden rounded-md border border-border bg-surface-subtle">
              {createPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Local object URLs are dynamic.
                <img src={createPreviewUrl} alt="Selected location preview" className="h-32 w-full object-cover" />
              ) : (
                <div className="grid h-32 place-items-center text-sm text-text-muted">No photo selected</div>
              )}
              <button type="button" className="flex w-full items-center justify-center gap-2 border-t border-border px-3 py-2 text-sm font-medium" onClick={() => createFileRef.current?.click()}>
                <ImagePlus className="size-4" /> {createImage ? "Replace photo" : "Upload photo"}
              </button>
              <input ref={createFileRef} name="image" type="file" accept="image/*" className="sr-only" onChange={(event) => setCreateImage(event.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="md:col-span-2" isLoading={create.isPending}>Create location</Button>
          </form>
          {create.error ? <p className="mt-3 text-sm text-error">{create.error.message}</p> : null}
        </section>

        <section className="mt-5 grid gap-3">
          {locations.data?.results.map((location) => (
            <LocationForm key={location.id} location={location} isUpdating={update.isPending} onUpdate={(payload) => update.mutate({ id: location.id, payload })} />
          ))}
        </section>
      </div>
    </main>
  );
}

function LocationForm({ location, isUpdating, onUpdate }: { location: DeliveryLocation; isUpdating: boolean; onUpdate: (payload: FormData | Record<string, unknown>) => void }) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useObjectUrl(selectedImage);
  const displayImage = previewUrl || location.image;

  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-[180px_1fr]"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!selectedImage) form.delete("image");
        onUpdate(form);
        setSelectedImage(null);
      }}
    >
      <div className="overflow-hidden rounded-md border border-border bg-surface-subtle">
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- Backend media URLs and local object URLs are dynamic.
          <img src={displayImage} alt={location.name} className="h-36 w-full object-cover" />
        ) : (
          <div className="grid h-36 place-items-center text-sm text-text-muted">No photo</div>
        )}
        <button type="button" className="flex w-full items-center justify-center gap-2 border-t border-border px-3 py-2 text-sm font-medium" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="size-4" /> {selectedImage ? "Replace selected" : "Replace photo"}
        </button>
        <input ref={fileInputRef} name="image" type="file" accept="image/*" className="sr-only" onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)} />
      </div>
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto_auto]">
          <Input name="name" defaultValue={location.name} required />
          <Input name="capacity_per_slot" defaultValue={location.capacity_per_slot} inputMode="numeric" required />
          <Button type="submit" variant="secondary" isLoading={isUpdating}>Save</Button>
          <Button type="button" variant={location.is_active ? "outline" : "secondary"} onClick={() => onUpdate({ is_active: !location.is_active })}>{location.is_active ? "Active" : "Inactive"}</Button>
        </div>
        <Input name="address" defaultValue={location.address} required />
        <p className="text-xs text-text-muted">{selectedImage?.name ?? (location.image ? "Current photo" : "No photo uploaded")}</p>
      </div>
    </form>
  );
}

function Gate() {
  return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>;
}
