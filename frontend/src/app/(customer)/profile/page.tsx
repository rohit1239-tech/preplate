"use client";
import { useAuthStore } from "@/store";
export default function ProfilePage() { const { user } = useAuthStore(); return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-6"><h1 className="text-3xl font-semibold">Profile</h1><p className="mt-4 text-text-secondary">{user ? `Logged in as ${user.phone}` : "Login during checkout to create a session."}</p></div></main>; }
