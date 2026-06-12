"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, ShieldCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { foodImages } from "@/lib/demo-assets";
import { useAuthStore } from "@/store";

export default function Home() {
  const { user, clearSession } = useAuthStore();
  const roleHref = user?.role === "RESTAURANT_ADMIN" ? "/restaurant/orders" : user?.role === "PLATFORM_ADMIN" ? "/admin" : "/orders";

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <section className="relative overflow-hidden bg-[#17120d] text-white">
        <Image src={foodImages[0]} alt="" fill priority className="object-cover opacity-45" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
        <div className="relative mx-auto flex min-h-[86vh] max-w-6xl flex-col justify-between px-4 py-5">
          <header className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold">Preplate</div>
            {user ? (
              <div className="flex items-center gap-2">
                <Link href={roleHref} className="rounded-md bg-white/12 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20">
                  {user.role === "CUSTOMER" ? "My orders" : user.role === "RESTAURANT_ADMIN" ? "Restaurant" : "Admin"}
                </Link>
                <button onClick={clearSession} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">Logout</button>
              </div>
            ) : (
              <Link href="/login" className="rounded-md bg-white/12 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20">Login</Link>
            )}
          </header>
          <div className="max-w-2xl pb-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-white/14 px-3 py-2 text-sm font-medium backdrop-blur">
              <MapPin className="size-4" /> Order to fixed pickup locations
            </div>
            <h1 className="text-5xl font-semibold tracking-normal sm:text-7xl">Meals arrive where your day already is.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/82">
              Pick your hostel, gate, or office park. Choose a slot. Order before cutoff. Collect with a PIN.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-13 bg-white px-6 text-base text-black hover:bg-white/90">
                <Link href="/locations">Choose pickup <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="secondary" className="h-13 bg-white/14 px-6 text-base text-white hover:bg-white/20">
                <Link href="/restaurants">Browse restaurants</Link>
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/75">
              <a className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/20" href="/login?role=CUSTOMER">Customer demo</a>
              <a className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/20" href="/login?role=RESTAURANT_ADMIN">Restaurant admin demo</a>
              <a className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/20" href="/login?role=PLATFORM_ADMIN">Platform admin demo</a>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-3">
        <Value icon={<Clock />} title="Hard cutoffs" text="Restaurants know demand before cooking starts." />
        <Value icon={<Truck />} title="Batch delivery" text="One trip per location means lower chaos and fresher handoffs." />
        <Value icon={<ShieldCheck />} title="PIN pickup" text="Every order is collected by the right customer." />
      </section>
    </main>
  );
}

function Value({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"><div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-warning-surface text-warning">{icon}</div><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{text}</p></div>;
}
