"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";
import {
  ATTENDANCE_STATUS_CLASS,
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_ORDER,
} from "./training-meta";
import type { AttendanceStatus } from "@/lib/generated/prisma/enums";

export interface AttendanceSheetRow {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  status: AttendanceStatus | null;
  minutesLate: number | null;
  note: string | null;
}

export interface AttendanceSheetProps {
  sessionId: string;
  rows: readonly AttendanceSheetRow[];
  /** False for a reader: the same sheet, without the controls. */
  editable: boolean;
}

interface RowState {
  status: AttendanceStatus | null;
  minutesLate: string;
  note: string;
}

/**
 * Taking the register.
 *
 * The flow is «همه حاضر» and then correcting the two or three who were not,
 * because that is what a coach does at the side of a pitch with a phone in
 * one hand (CLAUDE.md §15). Pressing it fills the sheet locally and, on save,
 * sends `defaultStatus: "PRESENT"` with only the exceptions — so the squad is
 * resolved on the server at the moment of writing, and a player added to the
 * team while this page was open is included rather than silently missed.
 *
 * Minutes and a note appear only on the rows that need them: a present player
 * has nothing to explain.
 *
 * Built on plain React state rather than React Hook Form. The stack allows
 * RHF, but this is a list of four-way choices with no cross-field validation,
 * and the library would earn its place at the tryout registration form in
 * Phase 10, not here (CLAUDE.md §2 — a dependency needs a reason).
 */
export function AttendanceSheet({
  sessionId,
  rows,
  editable,
}: AttendanceSheetProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [markedAll, setMarkedAll] = React.useState(false);

  const [state, setState] = React.useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.playerId,
        {
          status: row.status,
          minutesLate: row.minutesLate ? String(row.minutesLate) : "",
          note: row.note ?? "",
        },
      ]),
    ),
  );

  const update = (playerId: string, patch: Partial<RowState>): void => {
    setState((current) => ({
      ...current,
      [playerId]: {
        ...(current[playerId] ?? { status: null, minutesLate: "", note: "" }),
        ...patch,
      },
    }));
  };

  const markAllPresent = (): void => {
    setMarkedAll(true);
    setState((current) =>
      Object.fromEntries(
        rows.map((row) => [
          row.playerId,
          {
            ...(current[row.playerId] ?? {
              status: null,
              minutesLate: "",
              note: "",
            }),
            status: "PRESENT" as AttendanceStatus,
          },
        ]),
      ),
    );
  };

  const marked = rows.filter(
    (row) => state[row.playerId]?.status != null,
  ).length;

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const entries = rows
        .map((row) => ({ row, value: state[row.playerId] }))
        .filter(({ value }) => value?.status != null)
        // With "all present" sent as the default, only the exceptions travel.
        .filter(({ value }) => !markedAll || value!.status !== "PRESENT")
        .map(({ row, value }) => ({
          playerId: row.playerId,
          status: value!.status as AttendanceStatus,
          ...(value!.status === "LATE" && value!.minutesLate
            ? { minutesLate: Number(value!.minutesLate) }
            : {}),
          ...(value!.note.trim() ? { note: value!.note.trim() } : {}),
        }));

      const response = await fetch(
        `/api/v1/training/sessions/${sessionId}/attendance`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(markedAll ? { defaultStatus: "PRESENT" } : {}),
            entries,
          }),
        },
      );

      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error?: { message?: unknown } }).error?.message ===
            "string"
            ? (body as { error: { message: string } }).error.message
            : "ثبت حضور و غیاب انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success("حضور و غیاب ثبت شد");
      setMarkedAll(false);
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={markAllPresent}
            disabled={saving}
          >
            همه حاضر
          </Button>
          <p className="text-xs text-muted-foreground">
            {toPersianDigits(marked)} از {toPersianDigits(rows.length)} بازیکن
            مشخص شده
          </p>
        </div>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => {
          const value = state[row.playerId];
          const status = value?.status ?? null;

          return (
            <li key={row.playerId} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {row.jerseyNumber ? (
                    <span className="me-2 text-muted-foreground tabular-nums">
                      {toPersianDigits(row.jerseyNumber)}
                    </span>
                  ) : null}
                  {row.firstName} {row.lastName}
                </p>

                {editable ? (
                  <RadioGroupPrimitive.Root
                    dir="rtl"
                    value={status ?? ""}
                    onValueChange={(next) =>
                      update(row.playerId, {
                        status: next as AttendanceStatus,
                      })
                    }
                    aria-label={`وضعیت ${row.firstName} ${row.lastName}`}
                    className="flex overflow-hidden rounded-md border border-border"
                  >
                    {ATTENDANCE_STATUS_ORDER.map((option) => (
                      <RadioGroupPrimitive.Item
                        key={option}
                        value={option}
                        className={cn(
                          "border-s border-border px-2.5 py-1 text-xs transition-colors first:border-s-0",
                          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          status === option
                            ? ATTENDANCE_STATUS_CLASS[option]
                            : "text-muted-foreground",
                        )}
                      >
                        {ATTENDANCE_STATUS_LABEL[option]}
                      </RadioGroupPrimitive.Item>
                    ))}
                  </RadioGroupPrimitive.Root>
                ) : status ? (
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs",
                      ATTENDANCE_STATUS_CLASS[status],
                    )}
                  >
                    {ATTENDANCE_STATUS_LABEL[status]}
                    {status === "LATE" && row.minutesLate
                      ? ` · ${toPersianDigits(row.minutesLate)} دقیقه`
                      : null}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    ثبت نشده
                  </span>
                )}
              </div>

              {/* Only the exceptions have anything to explain. */}
              {editable && status === "LATE" ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  دقیقه تأخیر
                  <Input
                    type="number"
                    min={1}
                    max={240}
                    inputMode="numeric"
                    value={value?.minutesLate ?? ""}
                    onChange={(event) =>
                      update(row.playerId, { minutesLate: event.target.value })
                    }
                    className="h-7 w-20"
                  />
                </label>
              ) : null}

              {editable && (status === "ABSENT" || status === "EXCUSED") ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  توضیح
                  <Input
                    value={value?.note ?? ""}
                    onChange={(event) =>
                      update(row.playerId, { note: event.target.value })
                    }
                    maxLength={500}
                    className="h-7 flex-1"
                    placeholder="اختیاری"
                  />
                </label>
              ) : null}

              {!editable && row.note ? (
                <p className="text-xs text-muted-foreground">{row.note}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {editable ? (
        <Button type="button" onClick={save} disabled={saving || marked === 0}>
          {saving ? "در حال ثبت…" : "ثبت حضور و غیاب"}
        </Button>
      ) : null}
    </div>
  );
}
