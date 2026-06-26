"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, Settings, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store";
import type { UserRole } from "@/types";

const roleHome: Record<UserRole, string> = {
  CUSTOMER: "/locations",
  RESTAURANT_ADMIN: "/restaurant",
  PLATFORM_ADMIN: "/admin",
};

const roleLabel: Record<UserRole, string> = {
  CUSTOMER: "Customer",
  RESTAURANT_ADMIN: "Restaurant admin",
  PLATFORM_ADMIN: "Platform admin",
};

export function RoleHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <header className="mb-6 border-b border-border pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {user ? <Link href={roleHome[user.role]} className="inline-flex items-center gap-1 font-medium text-text-secondary hover:text-text-primary"><Home className="size-4" /> Home</Link> : null}
            {user ? <span className="rounded-sm bg-surface-subtle px-2 py-1 text-xs font-medium">{roleLabel[user.role]}</span> : null}
          </div>
          <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-text-secondary">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {action}
          {user?.role === "CUSTOMER" && pathname !== "/profile" ? <Button asChild variant="outline"><Link href="/profile"><User className="size-4" /> Profile</Link></Button> : null}
          {user?.role === "RESTAURANT_ADMIN" && pathname !== "/restaurant/settings" ? <Button asChild variant="outline"><Link href="/restaurant/settings"><Settings className="size-4" /> Settings</Link></Button> : null}
          {user ? <Button variant="secondary" onClick={logout}><LogOut className="size-4" /> Logout</Button> : null}
        </div>
      </div>
    </header>
  );
}
