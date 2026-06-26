"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/store";
import type { UserRole } from "@/types";

const roleRedirects: Record<UserRole, string> = {
  CUSTOMER: "/locations",
  RESTAURANT_ADMIN: "/restaurant",
  PLATFORM_ADMIN: "/admin",
};

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    router.replace(user ? roleRedirects[user.role] : "/login");
  }, [router, user]);

  return <main className="grid min-h-screen place-items-center bg-background p-6 text-text-secondary">Redirecting...</main>;
}
