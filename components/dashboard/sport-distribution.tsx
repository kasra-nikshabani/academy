import { chartSlot } from "@/components/ui/chart-palette";
import { toPersianDigits } from "@/lib/utils/number";

export interface DistributionItem {
  label: string;
  value: number;
  share: number;
}

/**
 * How the academy's players are spread across sports.
 *
 * A **stacked bar, not a pie**. Comparing angles is harder than comparing
 * lengths, and the question a manager actually asks — "is one sport carrying
 * everything?" — is answered by the width of one segment against the rest.
 *
 * Built from plain elements rather than Recharts, for the reason
 * `TalentFunnel` was in Phase 12: a handful of proportional segments does not
 * justify a chart library, and they lay out right-to-left with no override.
 * It is also a Server Component, so this section ships no JavaScript at all.
 *
 * Every segment is direct-labelled below the bar, so identity never rests on
 * colour alone (docs/UI_UX.md §10).
 */
export function SportDistribution({
  items,
}: {
  items: readonly DistributionItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        هنوز بازیکنی در هیچ تیمی ثبت نشده است.
      </p>
    );
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3">
      {/* `gap` rather than adjoining segments: a 2px strip of the card between
          two fills is what keeps the boundary readable when the colours are
          close, and it survives greyscale. */}
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`توزیع ${toPersianDigits(total)} بازیکن میان ${toPersianDigits(items.length)} رشته`}
      >
        {items.map((item, index) => (
          <span
            key={item.label}
            className="h-full first:rounded-s-full last:rounded-e-full"
            style={{
              width: `${item.share}%`,
              background: chartSlot(index),
            }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: chartSlot(index) }}
            />
            <span>{item.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {toPersianDigits(item.value)}
              <span className="ms-1 text-xs">
                ({toPersianDigits(item.share)}٪)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
