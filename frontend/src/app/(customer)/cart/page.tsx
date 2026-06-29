"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCartTotal, useLocalCartStore, useOrderContextStore } from "@/store";
import { formatMoney } from "@/lib/utils";

export default function CartPage() {
  const { restaurant, items, addItem, decrementItem, clear } = useLocalCartStore();
  const { deliveryLocationId, slotId } = useOrderContextStore();
  const hasOrderContext = Boolean(deliveryLocationId && slotId);
  const total = getCartTotal(items);

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Your cart</h1>
        <p className="mt-2 text-text-secondary">{restaurant?.name ?? "Add meals from a restaurant"}</p>
        {items.length ? <div className="mt-6 space-y-3">{items.map((item) => <div key={item.menuItem.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"><div><p className="font-semibold">{item.menuItem.name}</p><p className="text-sm text-text-secondary">{formatMoney(item.menuItem.price)} each</p></div><div className="flex items-center gap-3"><button onClick={() => decrementItem(item.menuItem.id)} className="grid size-9 place-items-center rounded-md bg-surface-subtle"><Minus className="size-4" /></button><span className="w-6 text-center font-semibold">{item.quantity}</span><button disabled={!hasOrderContext} title={!hasOrderContext ? "Choose pickup point and meal window before adding more items." : undefined} onClick={() => restaurant && addItem(restaurant, item.menuItem)} className="grid size-9 place-items-center rounded-md bg-primary text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" /></button></div></div>)}</div> : <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-10 text-center"><ShoppingBag className="mx-auto size-10 text-text-muted" /><p className="mt-3 font-semibold">Cart is empty</p><Button asChild className="mt-5"><Link href="/restaurants">Browse restaurants</Link></Button></div>}
        {items.length ? <div className="mt-6 rounded-xl border border-border bg-surface p-4"><div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatMoney(total)}</span></div><p className="mt-2 text-sm text-text-secondary">Payment method: Cash on Delivery</p>{!hasOrderContext ? <p className="mt-3 rounded-md bg-warning-surface px-3 py-2 text-sm text-warning">Choose pickup point and meal window before adding more items or checking out.</p> : null}<div className="mt-5 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={clear}>Clear cart</Button>{hasOrderContext ? <Button asChild><Link href="/checkout">Checkout</Link></Button> : <Button asChild><Link href={deliveryLocationId ? `/restaurants/${restaurant?.id ?? ""}` : "/locations"}>{deliveryLocationId ? "Choose meal window" : "Choose pickup point"}</Link></Button>}</div></div> : null}
      </div>
    </main>
  );
}
