import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description ? <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
