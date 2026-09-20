"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ReportFiltersProps {
  slug: string;
  teams: readonly { id: string; name: string }[];
  teamId: string;
  from: string;
  to: string;
}

const ALL_TEAMS = "__all__";

/** `YYYY-MM-DD` — what the URL carries and `z.coerce.date()` parses. */
function toParam(date: Date | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function fromParam(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The filter bar.
 *
 * Writes to the **URL**, not to component state (CLAUDE.md §25). That is what
 * makes a report shareable — an academy manager sends «گزارش حضور U14 از مهر»
 * as a link — and it is what lets the download button be the same address with
 * `&format=csv`, so the file can never be of a different query than the table.
 *
 * Dates are Jalali in the picker and ISO in the URL. A Jalali string in a query
 * parameter would have to be parsed back by hand on the server, and the two
 * parsers would eventually disagree about a leap year.
 */
export function ReportFilters({
  slug,
  teams,
  teamId,
  from,
  to,
}: ReportFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const apply = (patch: Record<string, string>): void => {
    const next = new URLSearchParams({ report: slug });
    const merged = { teamId, from, to, ...patch };

    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }

    startTransition(() => {
      router.push(`/dashboard/reports?${next.toString()}`);
    });
  };

  const hasFilters = Boolean(teamId || from || to);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-44 space-y-1.5">
        <Label htmlFor="report-team" className="text-xs">
          تیم
        </Label>
        <Select
          value={teamId || ALL_TEAMS}
          onValueChange={(value) =>
            apply({ teamId: value === ALL_TEAMS ? "" : value })
          }
        >
          <SelectTrigger id="report-team" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TEAMS}>همه تیم‌ها</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="report-from" className="text-xs">
          از تاریخ
        </Label>
        <DatePicker
          id="report-from"
          value={fromParam(from)}
          onChange={(date) => apply({ from: toParam(date) })}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="report-to" className="text-xs">
          تا تاریخ
        </Label>
        <DatePicker
          id="report-to"
          value={fromParam(to)}
          onChange={(date) => apply({ to: toParam(date) })}
          disabled={pending}
        />
      </div>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.push(`/dashboard/reports?report=${slug}`);
            })
          }
        >
          پاک کردن فیلترها
        </Button>
      ) : null}
    </div>
  );
}
