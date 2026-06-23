import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormField({
  label,
  error,
  helperText,
  required,
  optional,
  children,
  className,
}: {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="flex items-baseline gap-1 text-sm font-medium text-text-primary">
        <span>{label}</span>
        {required ? <span className="text-error" aria-label="required">*</span> : null}
        {!required && optional ? <span className="ml-1 text-xs font-normal text-text-muted">Optional</span> : null}
      </span>
      {children}
      {helperText && !error ? <span className="block text-xs text-text-muted">{helperText}</span> : null}
      {error ? <span className="block text-sm font-medium text-error">{error}</span> : null}
    </label>
  );
}
