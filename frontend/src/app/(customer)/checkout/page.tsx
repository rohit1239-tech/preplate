"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Lock, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCartItem, checkoutCart, initializeCart, sendOtp, verifyOtp } from "@/services/api";
import { getCartTotal, useAuthStore, useLocalCartStore, useOrderContextStore } from "@/store";
import { formatMoney } from "@/lib/utils";

export default function CheckoutPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("9999990002");
  const [otp, setOtp] = useState("123456");
  const [message, setMessage] = useState("");
  const { user, setSession } = useAuthStore();
  const { restaurant, items, clear } = useLocalCartStore();
  const { deliveryLocationId, deliveryDate, slotId } = useOrderContextStore();
  const total = getCartTotal(items);

  const sendOtpMutation = useMutation({ mutationFn: () => sendOtp({ phone }), onSuccess: () => setMessage("OTP sent. In local dev, use 123456.") });
  const verifyOtpMutation = useMutation({ mutationFn: () => verifyOtp({ phone, otp, role: "CUSTOMER" }), onSuccess: (session) => { setSession(session); setMessage("Logged in. Ready to place order."); } });
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!restaurant || !deliveryLocationId || !slotId) throw new Error("Choose location, slot, and restaurant first.");
      const cart = await initializeCart({ restaurant_id: restaurant.id, delivery_location_id: deliveryLocationId, slot_id: slotId, delivery_date: deliveryDate });
      for (const item of items) await addCartItem(cart.id, { menu_item_id: item.menuItem.id, quantity: item.quantity });
      return checkoutCart(cart.id, { payment_method: "COD" });
    },
    onSuccess: (order) => { clear(); router.push(`/orders/success?order=${order.id}`); },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h1 className="text-3xl font-semibold">Checkout</h1>
          <p className="mt-2 text-text-secondary">Login only when you are ready to place the order.</p>
          {!user ? <div className="mt-6 grid gap-4"><label className="space-y-2"><span className="text-sm font-medium">Phone number</span><Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label><Button onClick={() => sendOtpMutation.mutate()} isLoading={sendOtpMutation.isPending}><Phone className="size-4" /> Send OTP</Button><label className="space-y-2"><span className="text-sm font-medium">OTP</span><Input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" /></label><Button onClick={() => verifyOtpMutation.mutate()} isLoading={verifyOtpMutation.isPending}><Lock className="size-4" /> Verify and continue</Button>{message ? <p className="text-sm text-success">{message}</p> : null}</div> : <div className="mt-6 rounded-lg bg-success-surface p-4 text-success">Logged in as {user.phone}</div>}
        </section>
        <aside className="rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-4 lg:h-fit"><h2 className="text-lg font-semibold">Order summary</h2><div className="mt-4 space-y-3">{items.map((item) => <div key={item.menuItem.id} className="flex justify-between text-sm"><span>{item.quantity} x {item.menuItem.name}</span><span>{formatMoney(Number(item.menuItem.price) * item.quantity)}</span></div>)}</div><div className="mt-5 border-t border-border pt-4"><div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(total)}</span></div><p className="mt-2 text-sm text-text-secondary">Cash on Delivery</p></div><Button className="mt-5 w-full" disabled={!user || !items.length} isLoading={placeOrderMutation.isPending} onClick={() => placeOrderMutation.mutate()}>Place COD order</Button>{placeOrderMutation.error ? <p className="mt-3 text-sm text-error">{String(placeOrderMutation.error.message)}</p> : null}</aside>
      </div>
    </main>
  );
}
