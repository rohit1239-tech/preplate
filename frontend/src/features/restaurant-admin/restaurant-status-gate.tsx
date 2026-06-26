"use client";

import { useRouter } from "next/navigation";
import { Clock3, LogOut, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store";
import type { Restaurant } from "@/types";

const statusCopy: Record<string, { title: string; description: string; badge: "warning" | "error" | "neutral"; icon: typeof Clock3 }> = {
  PENDING: {
    title: "Onboarding request pending",
    description: "Your restaurant request is waiting for platform admin approval. Operational tools unlock after approval.",
    badge: "warning",
    icon: Clock3,
  },
  REJECTED: {
    title: "Onboarding request rejected",
    description: "Your restaurant request was rejected by the platform admin. Contact support or submit corrected details through the onboarding flow.",
    badge: "error",
    icon: XCircle,
  },
  SUSPENDED: {
    title: "Restaurant access suspended",
    description: "Operational tools are locked while this restaurant is suspended. Contact the platform admin for next steps.",
    badge: "error",
    icon: XCircle,
  },
};

export function isRestaurantOperational(restaurant: Restaurant | null | undefined) {
  return restaurant?.status === "APPROVED";
}

export function RestaurantOnboardingStatus({ restaurant }: { restaurant: Restaurant | null }) {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const copy = statusCopy[restaurant?.status ?? "PENDING"] ?? statusCopy.PENDING;
  const Icon = copy.icon;

  function logout() {
    clearSession();
    router.push("/login?role=RESTAURANT_ADMIN");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-text-primary">Restaurant onboarding</h1>
              <p className="mt-1 max-w-2xl text-text-secondary">Track your approval status.</p>
            </div>
            <Button variant="secondary" onClick={logout}><LogOut className="size-4" /> Logout</Button>
          </div>
        </header>
        <section className="rounded-md border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-text-secondary">
              <Icon className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-text-primary">{copy.title}</h1>
                <Badge variant={copy.badge}>{(restaurant?.status ?? "PENDING").toLowerCase()}</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{copy.description}</p>
              {restaurant ? (
                <div className="mt-5 grid gap-3 rounded-md bg-background p-4 text-sm sm:grid-cols-2">
                  <div><span className="text-text-muted">Restaurant</span><p className="mt-1 font-medium text-text-primary">{restaurant.name}</p></div>
                  <div><span className="text-text-muted">Phone</span><p className="mt-1 font-medium text-text-primary">{restaurant.phone}</p></div>
                  <div className="sm:col-span-2"><span className="text-text-muted">Description</span><p className="mt-1 text-text-primary">{restaurant.description || "Not provided"}</p></div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
