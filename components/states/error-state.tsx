"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title?: string;
  /**
   * A message the user can act on. Never pass a raw exception or a stack
   * trace here — internal detail belongs in the logs (docs/SECURITY.md).
   */
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "مشکلی پیش آمد",
  description = "در دریافت اطلاعات خطایی رخ داد. لطفاً دوباره تلاش کنید.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="size-4" />
          تلاش دوباره
        </Button>
      ) : null}
    </div>
  );
}
