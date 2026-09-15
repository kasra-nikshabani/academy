import { cn } from "@/lib/utils";
import { SepahanCrest } from "./sepahan-crest";

export interface BrandLockupProps {
  size?: "sm" | "md" | "lg";
  /** Hide the wordmark and show the crest alone — for a collapsed sidebar. */
  crestOnly?: boolean;
  className?: string;
}

const SIZES = {
  sm: { crest: 32, title: "text-sm", subtitle: "text-[11px]" },
  md: { crest: 44, title: "text-base", subtitle: "text-xs" },
  lg: { crest: 72, title: "text-xl", subtitle: "text-sm" },
} as const;

/**
 * The club mark as it should appear anywhere the product identifies itself:
 * login, app header, printed reports. Kept in one place so the crest is never
 * re-cropped or re-typeset per screen.
 */
export function BrandLockup({
  size = "md",
  crestOnly = false,
  className,
}: BrandLockupProps) {
  const scale = SIZES[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SepahanCrest
        size={scale.crest}
        label={crestOnly ? "باشگاه فولاد مبارکه سپاهان" : undefined}
        priority
      />
      {crestOnly ? null : (
        <div className="min-w-0">
          <p className={cn("leading-tight font-bold", scale.title)}>
            آکادمی سپاهان
          </p>
          <p
            className={cn(
              "leading-tight text-muted-foreground",
              scale.subtitle,
            )}
          >
            باشگاه فولاد مبارکه سپاهان
          </p>
        </div>
      )}
    </div>
  );
}
