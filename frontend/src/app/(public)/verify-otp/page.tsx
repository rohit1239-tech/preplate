import { VerifyOtpClient } from "./verify-otp-client";
import { normalizeRole } from "@/lib/auth-roles";

export default async function VerifyOtpPage({ searchParams }: { searchParams: Promise<{ phone?: string; role?: string }> }) {
  const params = await searchParams;
  return <VerifyOtpClient phone={params.phone ?? "9999990002"} role={normalizeRole(params.role)} />;
}
