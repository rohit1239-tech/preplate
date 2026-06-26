import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { useLocalCartStore } from "@/store";
import type { MenuItem, Restaurant } from "@/types";

export function MenuItemCard({ item, restaurant }: { item: MenuItem; restaurant: Restaurant }) {
  const { items, addItem, decrementItem } = useLocalCartStore();
  const quantity = items.find((cartItem) => cartItem.menuItem.id === item.id)?.quantity ?? 0;

  return (
    <div className="grid grid-cols-[1fr_112px] gap-4 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-sm)]">
      <div className="min-w-0">
        <h3 className="font-semibold text-text-primary">{item.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{item.description}</p>
        <p className="mt-3 text-sm font-semibold text-text-primary">{formatMoney(item.price)}</p>
      </div>
      <div className="space-y-2">
        <div className="h-24 overflow-hidden rounded-lg bg-surface-subtle">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Backend media URLs are dynamic.
            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center px-2 text-center text-xs font-medium text-text-muted">No item photo</div>
          )}
        </div>
        {quantity ? (
          <div className="grid h-9 grid-cols-3 overflow-hidden rounded-md border border-primary bg-primary text-surface">
            <button type="button" onClick={() => decrementItem(item.id)} className="grid place-items-center"><Minus className="size-4" /></button>
            <div className="grid place-items-center text-sm font-semibold">{quantity}</div>
            <button type="button" onClick={() => addItem(restaurant, item)} className="grid place-items-center"><Plus className="size-4" /></button>
          </div>
        ) : (
          <Button className="h-9 w-full" size="sm" onClick={() => addItem(restaurant, item)}>Add</Button>
        )}
      </div>
    </div>
  );
}
