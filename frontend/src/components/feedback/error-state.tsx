import { AlertCircle } from "lucide-react";

export function ErrorState({ title = "Something went wrong", description }: { title?: string; description?: string }) {
  return (
    <div className="rounded-md border border-error/20 bg-error-surface p-4 text-error">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
