/**
 * The chart palette and axis ink.
 *
 * Deliberately **not** in `chart.tsx`. That file is a Client Component and
 * imports Recharts; a Server Component that wanted nothing but a colour — the
 * squad table's legend swatches, for instance — would pull the whole charting
 * library into the server bundle and fail at module evaluation. Constants are
 * not interactive, so they live where both sides can reach them.
 *
 * ## Colour
 *
 * Series take `var(--color-chart-N)` directly. SVG `stroke` and `fill` resolve
 * CSS custom properties, so a theme switch repaints every chart with no React
 * involved and no palette duplicated into JavaScript.
 *
 * Those five slots were measured in Phase 14 — lightness band, chroma floor,
 * protanopia/deuteranopia separation and contrast against a card — and they
 * are assigned **in order**, never cycled: the order is what keeps adjacent
 * series distinguishable. A sixth series folds into "other" or becomes a
 * second chart rather than inventing a sixth hue (docs/UI_UX.md §9).
 */

export const CHART_SLOTS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

/**
 * The nth series colour, in fixed order.
 *
 * Past the last slot this repeats slot 1, and that is a **fallback, not a
 * cycle**: a generated seventh hue would be indistinguishable from one of the
 * six under colour blindness, so the answer to a seventh series is fewer
 * series — fold the tail into "other", or split the chart — never more
 * colours. The fallback is quiet by design and therefore easy to walk into:
 * the six performance metrics did exactly that against a five-slot palette,
 * and two of them wore the same swatch until someone looked. Anything mapping
 * a fixed set onto these slots should assert the mapping is one-to-one.
 */
export function chartSlot(index: number): string {
  return CHART_SLOTS[index] ?? CHART_SLOTS[0];
}

/** Recessive grid and axis ink, so the data is the darkest thing on the card. */
export const CHART_AXIS = {
  stroke: "var(--color-border)",
  tick: {
    fill: "var(--color-muted-foreground)",
    fontSize: 11,
  },
} as const;
