import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (session: { access: string; refresh: string; user: User }) => void;
  setTokens: (tokens: { access: string; refresh?: string }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ access, refresh, user }) => set({ accessToken: access, refreshToken: refresh, user }),
      setTokens: ({ access, refresh }) =>
        set((state) => ({
          accessToken: access,
          refreshToken: refresh ?? state.refreshToken,
        })),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: "preplate-session",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
