import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";
import type { FunnelStage } from "@/lib/services/talent-funnel";

export interface TalentFunnelProps {
  stages: readonly FunnelStage[];
  className?: string;
}

/** The club's gold deepens as the funnel narrows — the last bar is the one. */
const BAR_TONE: Record<FunnelStage["key"], string> = {
  applied: "bg-muted-foreground/40",
  passedScreening: "bg-brand-muted",
  evaluated: "bg-brand",
  accepted: "bg-brand-strong",
};

/**
 * The talent funnel (CLAUDE.md §24).
 *
 * Drawn with proportional bars rather than a chart library. Recharts is still
 * deferred to Phase 14 where there is a real charting need; four bars and
 * their labels do not justify a dependency, and plain elements read correctly
 * right-to-left without a single override (docs/ARCHITECTURE.md §6.1).
 *
 * Every bar is a share of the **applications**, not of the bar above it. That
 * keeps the widths honest when a later stage is larger than an earlier one —
 * which happens, and which a funnel that scaled each stage against the last
 * would have to hide.
 */
export function TalentFunnel({ stages, className }: TalentFunnelProps) {
  return (
    <ol className={cn("space-y-3", className)}>
      {stages.map((stage) => (
        <li key={stage.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-medium">{stage.label}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {toPersianDigits(stage.value)}
              </span>
              {" · "}
              {toPersianDigits(stage.share)}٪
              {stage.droppedFromPrevious !== null &&
              stage.droppedFromPrevious > 0 ? (
                <span className="ms-2 text-destructive">
                  {toPersianDigits(stage.droppedFromPrevious)} نفر کنار رفتند
                </span>
              ) : null}
            </p>
          </div>

          <div
            className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${stage.label}: ${toPersianDigits(stage.value)} نفر، ${toPersianDigits(stage.share)} درصد`}
          >
            <div
              className={cn("h-full rounded-full", BAR_TONE[stage.key])}
              style={{
                width: `${Math.max(stage.share, stage.value > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
