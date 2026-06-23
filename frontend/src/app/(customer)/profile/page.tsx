"use client";
import { RoleHeader } from "@/components/layout/role-header";
import { useAuthStore } from "@/store";
export default function ProfilePage() { const { user } = useAuthStore(); return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-3xl"><RoleHeader title="Profile" description="Account details for order communication and pickup." /><section className="rounded-xl border border-border bg-surface p-6"><p className="mt-4 text-text-secondary">{user ? `Logged in as ${user.email}` : "Login during checkout to create a session."}</p>{user?.phone ? <p className="mt-2 text-sm text-text-muted">Mobile {user.phone}</p> : null}</section></div></main>; }
