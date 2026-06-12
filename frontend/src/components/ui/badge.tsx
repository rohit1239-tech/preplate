import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-surface-subtle text-text-secondary",
      success: "bg-success-surface text-success",
      warning: "bg-warning-surface text-warning",
      error: "bg-error-surface text-error",
      dark: "bg-primary text-surface",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
