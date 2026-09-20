import type { CsvColumn } from "./csv";

/**
 * A report is a set of columns and a set of rows.
 *
 * **One definition, two renderings.** The table on screen and the CSV are
 * built from the same `columns`, so they cannot drift — and a report whose
 * export disagrees with the preview above it is the classic reporting bug,
 * usually discovered by somebody in a meeting.
 *
 * `value` produces the exported cell; `display` produces the on-screen one,
 * and defaults to `value`. They differ for exactly one reason: **numbers and
 * dates are Persian on screen and Latin in the file** (see `./csv.ts`). Making
 * that the only permitted difference is what keeps the two honest.
 */
export interface ReportColumn<TRow> extends CsvColumn<TRow> {
  /** What a person sees. Defaults to the exported value. */
  display?: (row: TRow) => string;
  /** Right-aligned, tabular figures on screen. */
  numeric?: boolean;
}

export interface ReportDefinition<TRow> {
  /** URL segment and the stem of the exported filename. */
  slug: string;
  title: string;
  description: string;
  columns: readonly ReportColumn<TRow>[];
}

export interface ReportResult<TRow = unknown> {
  slug: string;
  title: string;
  description: string;
  columns: readonly ReportColumn<TRow>[];
  rows: readonly TRow[];
  /**
   * What the report was run over, rendered for a person — it goes above the
   * table and into the conversation the file ends up in.
   */
  scopeLabel: string;
}

/** The on-screen cell: `display` when a column has one, else the raw value. */
export function displayCell<TRow>(
  column: ReportColumn<TRow>,
  row: TRow,
): string {
  if (column.display) return column.display(row);
  const value = column.value(row);
  return value === null || value === undefined ? "—" : String(value);
}
