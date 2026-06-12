import type { ReactNode } from "react";

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
      {error ? <span className="block text-sm text-error">{error}</span> : null}
    </label>
  );
}
