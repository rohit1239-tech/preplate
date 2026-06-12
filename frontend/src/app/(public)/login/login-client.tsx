"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendOtp } from "@/services/api";
import type { UserRole } from "@/types";

const roleDefaults: Record<UserRole, { phone: string; label: string }> = {
  CUSTOMER: { phone: "9999990002", label: "Customer" },
  RESTAURANT_ADMIN: { phone: "9999990001", label: "Restaurant admin" },
  PLATFORM_ADMIN: { phone: "9999990000", label: "Platform admin" },
};

export function LoginClient({ initialRole }: { initialRole: UserRole }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [phone, setPhone] = useState(roleDefaults[initialRole].phone);
  const mutation = useMutation({
    mutationFn: () => sendOtp({ phone }),
    onSuccess: () => router.push(`/verify-otp?phone=${phone}&role=${role}`),
  });

  function chooseRole(nextRole: UserRole) {
    setRole(nextRole);
    setPhone(roleDefaults[nextRole].phone);
  }

  return (
    <main className="grid min-h-screen bg-background px-4 py-6 md:grid-cols-2 md:p-0">
      <section className="hidden bg-primary p-10 text-white md:flex md:flex-col md:justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/80"><ArrowLeft className="size-4" /> Home</Link>
        <div><h1 className="text-5xl font-semibold">Login when your cart is ready.</h1><p className="mt-4 max-w-md text-white/70">Use demo roles to test customer, restaurant, and admin flows.</p></div>
      </section>
      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <h1 className="text-3xl font-semibold">Choose demo role</h1>
        <p className="mt-2 text-text-secondary">Local OTP is always 123456.</p>
        <div className="mt-6 grid grid-cols-3 gap-2">
          {(Object.keys(roleDefaults) as UserRole[]).map((key) => <button key={key} onClick={() => chooseRole(key)} className={`rounded-md border px-3 py-2 text-sm font-medium ${role === key ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}>{roleDefaults[key].label}</button>)}
        </div>
        <div className="mt-6 space-y-4">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
          <Button className="w-full" isLoading={mutation.isPending} onClick={() => mutation.mutate()}><Phone className="size-4" /> Send OTP</Button>
          <p className="text-sm text-text-muted">Selected: {roleDefaults[role].label}</p>
          {mutation.error ? <p className="text-sm text-error">{mutation.error.message}</p> : null}
        </div>
      </section>
    </main>
  );
}
