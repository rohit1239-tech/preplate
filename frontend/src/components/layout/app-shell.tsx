import type { ReactNode } from "react";
import { Bell, ShoppingBag, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div className="text-lg font-semibold tracking-normal text-text-primary">Preplate</div>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Cart"><ShoppingBag className="size-5" /></Button>
            <Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="size-5" /></Button>
            <Button variant="ghost" size="icon" aria-label="Profile"><User className="size-5" /></Button>
          </nav>
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-6xl px-4 py-6", className)}>{children}</main>
    </div>
  );
}
