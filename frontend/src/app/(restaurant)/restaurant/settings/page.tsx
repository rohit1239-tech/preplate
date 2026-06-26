"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Power, Save } from "lucide-react";

import { RoleHeader } from "@/components/layout/role-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnedRestaurant } from "@/features/restaurant-admin/use-owned-restaurant";
import { isRestaurantOperational, RestaurantOnboardingStatus } from "@/features/restaurant-admin/restaurant-status-gate";
import { updateRestaurant } from "@/services/api";

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

export default function RestaurantSettingsPage() {
  const { restaurant, isRestaurantAdmin, isLoading: isRestaurantLoading } = useOwnedRestaurant();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useObjectUrl(selectedImage);
  const displayImage = previewUrl || restaurant?.image || "";
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown> | FormData) => updateRestaurant(restaurant!.id, payload),
    onSuccess: () => {
      setSelectedImage(null);
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });

  if (!isRestaurantAdmin) return <Gate />;
  if (isRestaurantLoading) return <main className="min-h-screen bg-background p-6">Loading restaurant...</main>;
  if (!restaurant || !isRestaurantOperational(restaurant)) return <RestaurantOnboardingStatus restaurant={restaurant} />;

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
          <h2 className="text-xl font-semibold">Restaurant profile</h2>
          <form
            className="mt-4 grid gap-5 md:grid-cols-[220px_1fr]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (!selectedImage) form.delete("image");
              mutation.mutate(form);
            }}
          >
            <div className="overflow-hidden rounded-md border border-border bg-surface-subtle">
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- Backend media URLs and local object URLs are dynamic.
                <img src={displayImage} alt={restaurant.name} className="h-44 w-full object-cover" />
              ) : (
                <div className="grid h-44 place-items-center text-sm text-text-muted">No restaurant photo</div>
              )}
              <button type="button" className="flex w-full items-center justify-center gap-2 border-t border-border px-3 py-2 text-sm font-medium" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" /> {selectedImage ? "Replace selected" : "Upload photo"}
              </button>
              <input ref={fileInputRef} name="image" type="file" accept="image/*" className="sr-only" onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)} />
            </div>

            <div className="grid gap-3">
              <label className="space-y-1 text-sm font-medium">Name<Input name="name" defaultValue={restaurant.name} required /></label>
              <label className="space-y-1 text-sm font-medium">Phone<Input name="phone" defaultValue={restaurant.phone} inputMode="tel" /></label>
              <label className="space-y-1 text-sm font-medium">Description<textarea name="description" defaultValue={restaurant.description} className="min-h-28 w-full rounded-md border border-border bg-surface p-3 text-sm" /></label>
              <p className="text-xs text-text-muted">{selectedImage?.name ?? (restaurant.image ? "Current photo" : "No photo uploaded")}</p>
              <Button type="submit" isLoading={mutation.isPending}><Save className="size-4" /> Save settings</Button>
            </div>
          </form>
          {mutation.error ? <p className="mt-3 text-sm text-error">{mutation.error.message}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Gate() {
  return <main className="grid min-h-screen place-items-center bg-background"><Button asChild><Link href="/login?role=RESTAURANT_ADMIN">Login as restaurant admin</Link></Button></main>;
}
