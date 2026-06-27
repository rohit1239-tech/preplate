"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Lock, Mail } from "lucide-react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { cn, formatMoney } from "@/lib/utils";
import { firstAuthErrorField, type AuthField, type AuthFieldErrors, type AuthFormValues, type AuthMode, validateAuthForm } from "@/features/auth/validation";
import { addCartItem, checkoutCart, initializeCart, resendOtp, sendOtp, verifyOtp } from "@/services/api";
import { ApiError } from "@/services/api/errors";
import { getCartTotal, useAuthStore, useLocalCartStore, useOrderContextStore } from "@/store";
import type { VerifyOtpRequest } from "@/types";

const emptyValues: AuthFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  mobile: "",
  restaurantName: "",
  restaurantPhone: "",
  restaurantDescription: "",
};

function errorClass(error?: string) {
  return error ? "border-error bg-error-surface/40 focus:border-error focus:ring-2 focus:ring-error/20" : undefined;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState<AuthFormValues>(emptyValues);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendLocked, setResendLocked] = useState(false);
  const fieldRefs = useRef<Partial<Record<AuthField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const { user, setSession } = useAuthStore();
  const { restaurant, items, clear } = useLocalCartStore();
  const { deliveryLocationId, deliveryDate, slotId } = useOrderContextStore();
  const total = getCartTotal(items);
  const isCustomer = user?.role === "CUSTOMER";

  const sendOtpMutation = useMutation({
    mutationFn: () => sendOtp({ email: values.email.trim().toLowerCase(), role: "CUSTOMER", intent: mode === "signup" ? "SIGNUP" : "LOGIN" }),
    onSuccess: (delivery) => {
      setOtpSent(true);
      setOtp("");
      setCooldown(delivery.cooldown_seconds);
      setResendLocked(delivery.remaining_resends <= 0);
      setMessage("OTP sent. Check your email for the verification code.");
    },
  });
  const resendOtpMutation = useMutation({
    mutationFn: () => resendOtp({ email: values.email.trim().toLowerCase(), role: "CUSTOMER", intent: mode === "signup" ? "SIGNUP" : "LOGIN" }),
    onSuccess: (delivery) => {
      setOtp("");
      setCooldown(delivery.cooldown_seconds);
      setResendLocked(delivery.remaining_resends <= 0);
      setMessage(delivery.message ?? "OTP sent successfully.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) {
        const retryAfter = error.payload?.retry_after;
        if (typeof retryAfter === "number") {
          setCooldown(retryAfter);
          return;
        }
        setResendLocked(true);
      }
    },
  });
  const verifyOtpMutation = useMutation({
    mutationFn: () => {
      const payload: VerifyOtpRequest = {
        email: values.email.trim().toLowerCase(),
        otp,
        role: "CUSTOMER",
      };
      if (mode === "signup") {
        payload.first_name = values.firstName.trim();
        payload.last_name = values.lastName.trim();
        payload.mobile = values.mobile.trim();
      }
      return verifyOtp(payload);
    },
    onSuccess: (session) => { setSession(session); setMessage("Logged in. Ready to place order."); },
  });
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!isCustomer) throw new Error("Sign in with a customer account before placing your order.");
      if (!restaurant || !deliveryLocationId || !slotId) throw new Error("Choose location, slot, and restaurant first.");
      const cart = await initializeCart({ restaurant_id: restaurant.id, delivery_location_id: deliveryLocationId, slot_id: slotId, delivery_date: deliveryDate });
      for (const item of items) await addCartItem(cart.id, { menu_item_id: item.menuItem.id, quantity: item.quantity });
      return checkoutCart(cart.id, { payment_method: "COD" });
    },
    onSuccess: (order) => { clear(); router.push(`/orders/success?order=${order.id}`); },
  });

  function updateField(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function chooseMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrors({});
    setCooldown(0);
    setResendLocked(false);
  }

  function validateOtpIdentity() {
    setMessage("");
    const nextErrors = validateAuthForm(values, "CUSTOMER", mode);
    setErrors(nextErrors);
    const firstInvalid = firstAuthErrorField(nextErrors);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return false;
    }
    return true;
  }

  function sendOtpForCheckout() {
    if (!validateOtpIdentity()) return;
    sendOtpMutation.mutate();
  }

  function resendOtpForCheckout() {
    if (!validateOtpIdentity()) return;
    resendOtpMutation.mutate();
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resendDisabled = verifyOtpMutation.isPending || cooldown > 0 || resendLocked;

  return (
    <main className="min-h-screen bg-background px-4 py-4 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[minmax(0,1fr)_476px]">
        <section className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <h1 className="text-4xl font-semibold tracking-normal text-text-primary">Checkout</h1>
          <p className="mt-4 text-lg text-text-secondary">Verify your email when you are ready to place the order.</p>
          {!user ? (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-surface-subtle p-1">
                <button type="button" className={cn("rounded-md px-3 py-2 text-sm font-medium transition", mode === "signup" ? "bg-surface text-text-primary shadow-[var(--shadow-sm)]" : "text-text-secondary hover:text-text-primary")} onClick={() => chooseMode("signup")}>Create account</button>
                <button type="button" className={cn("rounded-md px-3 py-2 text-sm font-medium transition", mode === "login" ? "bg-surface text-text-primary shadow-[var(--shadow-sm)]" : "text-text-secondary hover:text-text-primary")} onClick={() => chooseMode("login")}>Sign in</button>
              </div>

              <div className="mt-6 rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
                <div className="space-y-4">
                  <FormField label="Email" required error={errors.email} helperText="We will send your checkout verification code here.">
                    <Input ref={(node) => { fieldRefs.current.email = node; }} value={values.email} onChange={(event) => updateField("email", event.target.value)} inputMode="email" placeholder="you@example.com" className={errorClass(errors.email)} />
                  </FormField>

                  {mode === "signup" ? (
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

                  <Button className="w-full" onClick={sendOtpForCheckout} isLoading={sendOtpMutation.isPending}><Mail className="size-4" /> Send email OTP</Button>

                  <FormField label="OTP" required helperText="Enter the six digit code from your email.">
                    <OtpInput value={otp} onChange={setOtp} disabled={verifyOtpMutation.isPending} />
                  </FormField>
                  {otpSent ? (
                    <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-text-secondary">Didn&apos;t receive the code?</span>
                      <Button type="button" variant="outline" size="sm" isLoading={resendOtpMutation.isPending} disabled={resendDisabled} onClick={resendOtpForCheckout}>
                        <Mail className="size-4" /> {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                      </Button>
                    </div>
                  ) : null}
                  <Button className="w-full" onClick={() => verifyOtpMutation.mutate()} disabled={otp.length !== 6} isLoading={verifyOtpMutation.isPending}><Lock className="size-4" /> Verify and continue</Button>
                  {message ? <p className="rounded-md bg-success-surface px-3 py-2 text-sm font-medium text-success">{message}</p> : null}
                  {sendOtpMutation.error ? <p className="rounded-md bg-error-surface px-3 py-2 text-sm font-medium text-error">{sendOtpMutation.error.message}</p> : null}
                  {resendOtpMutation.error ? <p className="rounded-md bg-error-surface px-3 py-2 text-sm font-medium text-error">{resendOtpMutation.error.message}</p> : null}
                  {verifyOtpMutation.error ? <p className="rounded-md bg-error-surface px-3 py-2 text-sm font-medium text-error">{verifyOtpMutation.error.message}</p> : null}
                </div>
              </div>
            </div>
          ) : <div className="mt-6 rounded-md border border-border bg-success-surface p-5 text-success shadow-[var(--shadow-sm)]">Logged in as {user.email}</div>}
        </section>
        <aside className="rounded-2xl border border-border bg-surface p-6 md:p-7 lg:sticky lg:top-4 lg:h-fit">
          <h2 className="text-2xl font-semibold text-text-primary">Order summary</h2>
          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div key={item.menuItem.id} className="flex justify-between gap-4 text-lg text-text-primary">
                <span>{item.quantity} x {item.menuItem.name}</span>
                <span>{formatMoney(Number(item.menuItem.price) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-border pt-6">
            <div className="flex justify-between text-lg font-semibold text-text-primary"><span>Total</span><span>{formatMoney(total)}</span></div>
            <p className="mt-3 text-base text-text-secondary">Cash on Delivery</p>
          </div>
          <Button className="mt-7 h-14 w-full text-lg" disabled={!isCustomer || !items.length} isLoading={placeOrderMutation.isPending} onClick={() => placeOrderMutation.mutate()}>Place COD order</Button>
          {placeOrderMutation.error ? <p className="mt-3 text-sm text-error">{String(placeOrderMutation.error.message)}</p> : null}
        </aside>
      </div>
    </main>
  );
}
