"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, ShoppingBag, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MenuItemCard } from "@/features/menu/menu-item-card";
import { pickImage, restaurantImages } from "@/lib/demo-assets";
import { listMenuItems, getRestaurant } from "@/services/api";
import { queryKeys } from "@/services/query-keys";
import { getCartTotal, useLocalCartStore } from "@/store";
import { formatMoney } from "@/lib/utils";

export default function RestaurantMenuPage() {
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;
  const restaurant = useQuery({ queryKey: queryKeys.restaurant(restaurantId), queryFn: () => getRestaurant(restaurantId) });
  const menu = useQuery({ queryKey: queryKeys.menuItems({ restaurant: restaurantId }), queryFn: () => listMenuItems({ restaurant: restaurantId, page_size: 50 }) });
  const { items } = useLocalCartStore();
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  const total = getCartTotal(items);

  if (!restaurant.data) return <main className="min-h-screen bg-background p-4">Loading restaurant...</main>;

  return (
    <main className="min-h-screen bg-background pb-28">
      <section className="relative h-72 overflow-hidden text-white">
        <Image src={pickImage(restaurantImages, restaurantId)} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-between px-4 py-5">
          <Link href="/restaurants" className="inline-flex w-fit items-center gap-2 rounded-md bg-black/30 px-3 py-2 text-sm font-medium backdrop-blur"><ArrowLeft className="size-4" /> Restaurants</Link>
          <div><h1 className="text-4xl font-semibold">{restaurant.data.name}</h1><p className="mt-2 max-w-xl text-white/80">{restaurant.data.description}</p><div className="mt-4 flex gap-3 text-sm"><span className="inline-flex items-center gap-1"><Star className="size-4 fill-warning text-warning" /> 4.7</span><span className="inline-flex items-center gap-1"><Clock className="size-4" /> Slot based</span></div></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2">
        {menu.data?.results.map((item) => <MenuItemCard key={item.id} item={item} restaurant={restaurant.data} />)}
      </section>
      {totalItems ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center justify-between rounded-xl bg-primary p-3 text-white"><div><p className="font-semibold">{totalItems} items · {formatMoney(total)}</p><p className="text-xs text-white/70">Cart ready for checkout</p></div><Button asChild variant="secondary"><Link href="/cart"><ShoppingBag className="size-4" /> View cart</Link></Button></div></div> : null}
    </main>
  );
}
