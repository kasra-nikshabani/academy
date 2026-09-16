import type * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import type { LucideIcon } from "lucide-react";

export interface DataTableColumn<TRow> {
  /** Stable key; also the React key for the cell. */
  id: string;
  header: string;
  cell: (row: TRow) => React.ReactNode;
  /** Right-aligned action columns, narrow numeric columns, and so on. */
  className?: string;
  /** Hidden below `sm` — for columns that are useful but not essential. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<TRow> {
  rows: readonly TRow[];
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rowKey: (row: TRow) => string;
  empty: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  className?: string;
}

/**
 * A plain data table.
 *
 * Deliberately not built on a table library: these lists are read from the
 * server already sorted and already paginated, so a client-side table engine
 * would add a dependency and a second source of truth for ordering. When a
 * screen genuinely needs client-side sorting or column resizing, that is the
 * moment to reach for one.
 *
 * The table scrolls inside its own container so a wide row never forces the
 * whole page sideways (docs/UI_UX.md §7).
 */
export function DataTable<TRow>({
  rows,
  columns,
  rowKey,
  empty,
  className,
}: DataTableProps<TRow>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        {...(empty.icon ? { icon: empty.icon } : {})}
        title={empty.title}
        {...(empty.description ? { description: empty.description } : {})}
        {...(empty.action ? { action: empty.action } : {})}
      />
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  column.className,
                  column.hideOnMobile && "hidden sm:table-cell",
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    column.className,
                    column.hideOnMobile && "hidden sm:table-cell",
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
