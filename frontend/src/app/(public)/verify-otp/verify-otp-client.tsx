"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { sendOtp, verifyOtp } from "@/services/api";
import { useAuthStore } from "@/store";
import type { AuthIntent, UserRole, VerifyOtpRequest } from "@/types";

const roleRedirects: Record<UserRole, string> = {
  CUSTOMER: "/locations",
  RESTAURANT_ADMIN: "/restaurant",
  PLATFORM_ADMIN: "/admin",
};

function readPendingSignup(email: string, role: UserRole): Partial<VerifyOtpRequest> {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(`preplate-signup:${role}:${email}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<VerifyOtpRequest>;
  } catch {
    return {};
  }
}

function getAuthIntent(email: string, role: UserRole): AuthIntent {
  if (role === "PLATFORM_ADMIN") return "LOGIN";
  return Object.keys(readPendingSignup(email, role)).length ? "SIGNUP" : "LOGIN";
}

function clearPendingSignup(email: string, role: UserRole) {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(`preplate-signup:${role}:${email}`);
}

export function VerifyOtpClient({ email, role }: { email: string; role: UserRole }) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const setSession = useAuthStore((state) => state.setSession);
  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp({ email, otp, role, ...readPendingSignup(email, role) }),
    onSuccess: (session) => {
      clearPendingSignup(email, role);
      setSession(session);
      router.push(roleRedirects[session.user.role]);
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => sendOtp({ email, role, intent: getAuthIntent(email, role) }),
    onSuccess: () => {
      setOtp("");
      setMessage("A new OTP has been sent to your email.");
    },
  });

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-success-surface text-success"><ShieldCheck className="size-6" /></div>
        <h1 className="text-3xl font-semibold">Verify email OTP</h1>
        <p className="mt-2 text-text-secondary">Sent to {email}.</p>
        <div className="mt-6 space-y-4">
          <OtpInput value={otp} onChange={setOtp} disabled={verifyMutation.isPending} />
          <Button className="w-full" isLoading={verifyMutation.isPending} disabled={!email || otp.length !== 6} onClick={() => verifyMutation.mutate()}>Verify and continue</Button>
          <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-text-secondary">Didn&apos;t receive the code?</span>
            <Button type="button" variant="outline" size="sm" isLoading={resendMutation.isPending} disabled={!email || verifyMutation.isPending} onClick={() => resendMutation.mutate()}>
              <Mail className="size-4" /> Resend OTP
            </Button>
          </div>
          {message ? <p className="rounded-md bg-success-surface px-3 py-2 text-sm font-medium text-success">{message}</p> : null}
          {verifyMutation.error ? <p className="text-sm text-error">{verifyMutation.error.message}</p> : null}
          {resendMutation.error ? <p className="text-sm text-error">{resendMutation.error.message}</p> : null}
        </div>
      </section>
    </main>
  );
}
