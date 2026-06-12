"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Settings, Soup, Timer, ClipboardList } from "lucide-react";
import { listOrders } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store";

const nav = [
  { href: "/restaurant/orders", label: "Orders", icon: ClipboardList },
  { href: "/restaurant/menu", label: "Menu", icon: Soup },
  { href: "/restaurant/locations", label: "Locations", icon: MapPin },
  { href: "/restaurant/slots", label: "Slots", icon: Timer },
  { href: "/restaurant/settings", label: "Settings", icon: Settings },
];

export default function RestaurantDashboard() {
  const user = useAuthStore((state) => state.user);
  const orders = useQuery({ queryKey: queryKeys.orders({ role: "restaurant" }), queryFn: () => listOrders({ page_size: 20 }), enabled: user?.role === "RESTAURANT_ADMIN" });
  const pending = orders.data?.results.filter((order) => order.status === "PLACED").length ?? 0;
  return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-semibold">Restaurant operations</h1><p className="mt-2 text-text-secondary">Manage orders, menu, pickup capacity, slots, and open/close state.</p></div><Button asChild variant="secondary"><Link href="/login?role=RESTAURANT_ADMIN">Demo login</Link></Button></div><div className="mt-6 grid gap-4 md:grid-cols-3"><Kpi label="Orders" value={orders.data?.count ?? 0} /><Kpi label="Pending" value={pending} /><Kpi label="Payment" value="COD" /></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{nav.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5"><item.icon className="mb-3 size-5 text-warning" /><p className="font-semibold">{item.label}</p></Link>)}</div></div></main>;
}
function Kpi({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-surface p-5"><p className="text-sm text-text-secondary">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>; }
