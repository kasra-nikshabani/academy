import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";

export interface ReportTableColumn {
  header: string;
  numeric: boolean;
}

export interface ReportTableProps {
  columns: readonly ReportTableColumn[];
  /** Pre-rendered cells, in column order — the same strings the CSV carries. */
  rows: readonly (readonly string[])[];
  /** Rows shown before the table says "and more"; the file has them all. */
  limit?: number;
}

/**
 * The preview.
 *
 * A Server Component rendering strings the service already produced, so the
 * table and the CSV cannot disagree about what a cell says.
 *
 * Numbers are Persian **here and only here**. The file they came from carries
 * Latin digits, because its reader is a spreadsheet (lib/reports/csv.ts).
 *
 * Only the first rows are drawn. A term's register is hundreds of rows and
 * nobody reads them in a browser — they look at the top to check the report is
 * the one they meant, then download it.
 */
export function ReportTable({ columns, rows, limit = 25 }: ReportTableProps) {
  const shown = rows.slice(0, limit);
  const hidden = rows.length - shown.length;

  return (
    <div className="space-y-2">
      {/* Wide table, narrow phone: it scrolls inside its own box rather than
          pushing the page sideways. */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={cn(
                    "p-2.5 font-medium whitespace-nowrap",
                    column.numeric ? "text-center" : "text-start",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, rowIndex) => (
              <tr
                // The row's own cells are the only identity it has; a report
                // row is a computed tuple, not a record with an id.
                key={`${rowIndex}-${row[0] ?? ""}`}
                className="border-b border-border last:border-0 hover:bg-accent/30"
              >
                {row.map((cell, cellIndex) => {
                  const column = columns[cellIndex];
                  return (
                    <td
                      key={cellIndex}
                      className={cn(
                        "p-2.5 whitespace-nowrap",
                        column?.numeric
                          ? "text-center tabular-nums"
                          : "text-start",
                      )}
                    >
                      {column?.numeric ? toPersianDigits(cell) : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 ? (
        <p className="text-xs text-muted-foreground">
          {toPersianDigits(shown.length)} ردیف از {toPersianDigits(rows.length)}{" "}
          نمایش داده شده — فایل CSV همه ردیف‌ها را دارد.
        </p>
      ) : null}
    </div>
  );
}
