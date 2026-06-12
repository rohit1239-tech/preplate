import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderSuccessPage() {
  return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-md)]"><CheckCircle2 className="mx-auto size-12 text-success" /><h1 className="mt-4 text-3xl font-semibold">Order placed</h1><p className="mt-2 text-text-secondary">Your pickup PIN will be available on the order details screen. Keep it handy at the delivery point.</p><Button asChild className="mt-6"><Link href="/orders">View orders</Link></Button></div></main>;
}
