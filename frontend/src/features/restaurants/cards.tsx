import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pickImage, restaurantImages } from "@/lib/demo-assets";
import type { Restaurant } from "@/types";

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link href={`/restaurants/${restaurant.id}`} className="group block overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="relative h-44 overflow-hidden">
        <Image src={pickImage(restaurantImages, restaurant.id)} alt="" fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute left-3 top-3 rounded-md bg-surface px-2 py-1 text-xs font-semibold text-text-primary">Ordering open</div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{restaurant.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{restaurant.description}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-text-secondary">
          <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-warning text-warning" /> 4.7</span>
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Scheduled slots</span>
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> Fixed pickup</span>
        </div>
        <Button className="w-full" variant="secondary">View menu</Button>
      </div>
    </Link>
  );
}
