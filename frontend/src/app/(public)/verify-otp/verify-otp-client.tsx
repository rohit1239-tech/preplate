"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyOtp } from "@/services/api";
import { useAuthStore } from "@/store";
import type { UserRole } from "@/types";

const roleRedirects: Record<UserRole, string> = {
  CUSTOMER: "/locations",
  RESTAURANT_ADMIN: "/restaurant/orders",
  PLATFORM_ADMIN: "/admin",
};

export function VerifyOtpClient({ phone, role }: { phone: string; role: UserRole }) {
  const router = useRouter();
  const [otp, setOtp] = useState("123456");
  const setSession = useAuthStore((state) => state.setSession);
  const mutation = useMutation({
    mutationFn: () => verifyOtp({ phone, otp, role }),
    onSuccess: (session) => {
      setSession(session);
      router.push(roleRedirects[session.user.role]);
    },
  });

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-success-surface text-success"><ShieldCheck className="size-6" /></div>
        <h1 className="text-3xl font-semibold">Verify OTP</h1>
        <p className="mt-2 text-text-secondary">Sent to {phone}. Use 123456 in local dev.</p>
        <p className="mt-1 text-sm text-text-muted">Role: {role.replaceAll("_", " ").toLowerCase()}</p>
        <div className="mt-6 space-y-4">
          <Input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} />
          <Button className="w-full" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>Verify and continue</Button>
          {mutation.error ? <p className="text-sm text-error">{mutation.error.message}</p> : null}
        </div>
      </section>
    </main>
  );
}
