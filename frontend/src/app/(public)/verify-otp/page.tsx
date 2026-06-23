import { normalizeRole } from "@/lib/auth-roles";
import { VerifyOtpClient } from "./verify-otp-client";

export default async function VerifyOtpPage({ searchParams }: { searchParams: Promise<{ email?: string; role?: string }> }) {
  const params = await searchParams;
  return <VerifyOtpClient email={params.email ?? ""} role={normalizeRole(params.role)} />;
}
