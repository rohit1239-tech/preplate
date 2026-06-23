"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, ShieldCheck, UserRound } from "lucide-react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { firstAuthErrorField, type AuthField, type AuthFieldErrors, type AuthFormValues, type AuthMode, validateAuthForm } from "@/features/auth/validation";
import { sendOtp } from "@/services/api";
import type { UserRole, VerifyOtpRequest } from "@/types";

const flowLabels: Record<UserRole, { label: string; title: string; description: string; icon: typeof UserRound }> = {
  CUSTOMER: {
    label: "Customer",
    title: "Order meals for your pickup location",
    description: "Create or access your customer account with a secure email OTP.",
    icon: UserRound,
  },
  RESTAURANT_ADMIN: {
    label: "Restaurant",
    title: "Manage restaurant operations",
    description: "Request onboarding or access an approved restaurant account.",
    icon: Building2,
  },
  PLATFORM_ADMIN: {
    label: "Platform admin",
    title: "Platform access",
    description: "Platform admin accounts are created by backend administration only.",
    icon: ShieldCheck,
  },
};

const emptyValues: AuthFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  mobile: "",
  restaurantName: "",
  restaurantPhone: "",
  restaurantDescription: "",
};

function storeSignup(email: string, role: UserRole, payload: Partial<VerifyOtpRequest>) {
  window.sessionStorage.setItem(`preplate-signup:${role}:${email}`, JSON.stringify(payload));
}

function clearStoredSignup(email: string, role: UserRole) {
  window.sessionStorage.removeItem(`preplate-signup:${role}:${email}`);
}

function errorClass(error?: string) {
  return error ? "border-error bg-error-surface/40 focus:border-error focus:ring-2 focus:ring-error/20" : undefined;
}

export function LoginClient({ initialRole }: { initialRole: UserRole }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [mode, setMode] = useState<AuthMode>(initialRole === "PLATFORM_ADMIN" ? "login" : "signup");
  const [values, setValues] = useState<AuthFormValues>(emptyValues);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const fieldRefs = useRef<Partial<Record<AuthField, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const mutation = useMutation({
    mutationFn: () => sendOtp({ email: values.email.trim().toLowerCase(), role, intent: mode === "signup" ? "SIGNUP" : "LOGIN" }),
    onSuccess: () => {
      const normalizedEmail = values.email.trim().toLowerCase();
      if (mode === "signup") {
        const payload: Partial<VerifyOtpRequest> = {
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          mobile: values.mobile.trim(),
        };
        if (role === "RESTAURANT_ADMIN") {
          payload.restaurant_name = values.restaurantName.trim();
          payload.restaurant_phone = values.restaurantPhone.trim();
          payload.restaurant_description = values.restaurantDescription.trim();
        }
        storeSignup(normalizedEmail, role, payload);
      } else {
        clearStoredSignup(normalizedEmail, role);
      }
      router.push(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}&role=${role}`);
    },
  });

  function updateField(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function chooseRole(nextRole: UserRole) {
    setRole(nextRole);
    setMode(nextRole === "PLATFORM_ADMIN" ? "login" : "signup");
    setErrors({});
  }

  function chooseMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrors({});
  }

  function submit() {
    const nextErrors = validateAuthForm(values, role, mode);
    setErrors(nextErrors);
    const firstInvalid = firstAuthErrorField(nextErrors);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }
    mutation.mutate();
  }

  const selectedFlow = flowLabels[role];

  return (
    <main className="grid min-h-screen bg-background px-4 py-6 md:grid-cols-[0.9fr_1.1fr] md:p-0">
      <section className="hidden bg-primary p-10 text-white md:flex md:flex-col md:justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/80"><ArrowLeft className="size-4" /> Home</Link>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-white/50">Preplate access</p>
          <h1 className="mt-3 max-w-lg text-5xl font-semibold leading-tight">Email OTP sign in for scheduled meal operations.</h1>
          <p className="mt-4 max-w-md text-white/70">Customers, restaurants, and platform admins use one secure email verification flow with role-specific onboarding.</p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-xl flex-col justify-center py-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">Account access</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary">{selectedFlow.title}</h1>
          <p className="mt-2 text-text-secondary">{selectedFlow.description}</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {(Object.keys(flowLabels) as UserRole[]).map((key) => {
            const Icon = flowLabels[key].icon;
            const active = role === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => chooseRole(key)}
                className={cn(
                  "rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary text-white" : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary",
                )}
              >
                <Icon className="mx-auto mb-1 size-4" />{flowLabels[key].label}
              </button>
            );
          })}
        </div>

        {role !== "PLATFORM_ADMIN" ? (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-surface-subtle p-1">
            <button type="button" className={cn("rounded-md px-3 py-2 text-sm font-medium transition", mode === "signup" ? "bg-surface text-text-primary shadow-[var(--shadow-sm)]" : "text-text-secondary hover:text-text-primary")} onClick={() => chooseMode("signup")}>{role === "RESTAURANT_ADMIN" ? "Request onboarding" : "Create account"}</button>
            <button type="button" className={cn("rounded-md px-3 py-2 text-sm font-medium transition", mode === "login" ? "bg-surface text-text-primary shadow-[var(--shadow-sm)]" : "text-text-secondary hover:text-text-primary")} onClick={() => chooseMode("login")}>Sign in</button>
          </div>
        ) : null}

        <div className="mt-6 rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <div className="space-y-4">
            <FormField label="Email" required error={errors.email} helperText="We will send a one-time verification code here.">
              <Input ref={(node) => { fieldRefs.current.email = node; }} value={values.email} onChange={(event) => updateField("email", event.target.value)} inputMode="email" placeholder="you@example.com" className={errorClass(errors.email)} />
            </FormField>

            {mode === "signup" && role !== "PLATFORM_ADMIN" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="First name" required error={errors.firstName}>
                  <Input ref={(node) => { fieldRefs.current.firstName = node; }} value={values.firstName} onChange={(event) => updateField("firstName", event.target.value)} className={errorClass(errors.firstName)} />
                </FormField>
                <FormField label="Last name" required error={errors.lastName}>
                  <Input ref={(node) => { fieldRefs.current.lastName = node; }} value={values.lastName} onChange={(event) => updateField("lastName", event.target.value)} className={errorClass(errors.lastName)} />
                </FormField>
                <FormField label="Mobile number" required error={errors.mobile} helperText="10 digits, starting with 6-9." className="sm:col-span-2">
                  <Input ref={(node) => { fieldRefs.current.mobile = node; }} value={values.mobile} onChange={(event) => updateField("mobile", event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" className={errorClass(errors.mobile)} />
                </FormField>
              </div>
            ) : null}

            {mode === "signup" && role === "RESTAURANT_ADMIN" ? (
              <div className="grid gap-4">
                <FormField label="Restaurant name" required error={errors.restaurantName}>
                  <Input ref={(node) => { fieldRefs.current.restaurantName = node; }} value={values.restaurantName} onChange={(event) => updateField("restaurantName", event.target.value)} className={errorClass(errors.restaurantName)} />
                </FormField>
                <FormField label="Restaurant contact number" required error={errors.restaurantPhone} helperText="10 digits, starting with 6-9.">
                  <Input ref={(node) => { fieldRefs.current.restaurantPhone = node; }} value={values.restaurantPhone} onChange={(event) => updateField("restaurantPhone", event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" className={errorClass(errors.restaurantPhone)} />
                </FormField>
                <FormField label="Restaurant description" required error={errors.restaurantDescription}>
                  <textarea ref={(node) => { fieldRefs.current.restaurantDescription = node; }} value={values.restaurantDescription} onChange={(event) => updateField("restaurantDescription", event.target.value)} className={cn("min-h-24 w-full rounded-md border border-border bg-surface p-3 text-sm text-text-primary shadow-[var(--shadow-sm)] outline-none transition-colors focus:border-border-strong", errorClass(errors.restaurantDescription))} />
                </FormField>
              </div>
            ) : null}

            <Button className="w-full" isLoading={mutation.isPending} onClick={submit}><Mail className="size-4" /> Send email OTP</Button>
            {mutation.error ? <p className="rounded-md bg-error-surface px-3 py-2 text-sm font-medium text-error">{mutation.error.message}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
