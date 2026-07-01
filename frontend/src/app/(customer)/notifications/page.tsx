"use client";

import { useQuery } from "@tanstack/react-query";

import { listNotifications } from "@/services/api";
import { queryKeys } from "@/services/query-keys";

export default function NotificationsPage() {
  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
  });

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <div className="mt-6 space-y-3">
          {notifications.data?.results.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-text-secondary">{item.message}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
