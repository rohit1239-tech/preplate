import { LoginClient } from "./login-client";
import { normalizeRole } from "@/lib/auth-roles";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  return <LoginClient initialRole={normalizeRole(params.role)} />;
}
