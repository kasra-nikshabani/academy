"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";
import type { LineupRole } from "@/lib/generated/prisma/enums";

export interface SquadMember {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
}

export interface SheetRow {
  playerId: string;
  role: LineupRole | null;
  shirtNumber: number | null;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchSheetProps {
  matchId: string;
  squad: readonly SquadMember[];
  rows: readonly SheetRow[];
  editable: boolean;
  /** Stats only make sense once the match has actually started. */
  statsOpen: boolean;
}

type Selection = "OUT" | "STARTER" | "SUBSTITUTE";

interface RowState {
  selection: Selection;
  shirtNumber: string;
  minutesPlayed: string;
  goals: string;
  assists: string;
  yellowCards: string;
  redCards: string;
}

const SELECTIONS: ReadonlyArray<{ value: Selection; label: string }> = [
  { value: "STARTER", label: "اصلی" },
  { value: "SUBSTITUTE", label: "ذخیره" },
  { value: "OUT", label: "خارج" },
];

const SELECTION_CLASS: Record<Selection, string> = {
  STARTER: "bg-success text-success-foreground",
  SUBSTITUTE: "bg-brand text-brand-foreground",
  OUT: "bg-muted text-muted-foreground",
};

/**
 * The team sheet, and what each player did.
 *
 * One screen, two jobs, in the order they happen: a coach names the squad
 * before the match and fills in the numbers after it. The statistics columns
 * stay hidden until kick-off, because a goal recorded before the whistle is a
 * record of something that has not happened — the same rule the attendance
 * register follows.
 *
 * Selecting the squad and saving it is one request that replaces the whole
 * sheet: a player switched to «خارج» is removed. That is what redrawing a
 * team sheet means, and it makes pressing save twice harmless.
 */
export function MatchSheet({
  matchId,
  squad,
  rows,
  editable,
  statsOpen,
}: MatchSheetProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const [state, setState] = React.useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      squad.map((member) => {
        const row = rows.find((item) => item.playerId === member.playerId);
        return [
          member.playerId,
          {
            selection: (row?.role ?? "OUT") as Selection,
            shirtNumber: row?.shirtNumber
              ? String(row.shirtNumber)
              : member.jerseyNumber
                ? String(member.jerseyNumber)
                : "",
            minutesPlayed: row ? String(row.minutesPlayed) : "",
            goals: row ? String(row.goals) : "",
            assists: row ? String(row.assists) : "",
            yellowCards: row ? String(row.yellowCards) : "",
            redCards: row ? String(row.redCards) : "",
          },
        ];
      }),
    ),
  );

  const update = (playerId: string, patch: Partial<RowState>): void =>
    setState((current) => ({
      ...current,
      [playerId]: { ...current[playerId]!, ...patch },
    }));

  const named = squad.filter(
    (member) => state[member.playerId]?.selection !== "OUT",
  );

  async function send(
    url: string,
    body: unknown,
    success: string,
  ): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: { message?: unknown } }).error
            ?.message === "string"
            ? (payload as { error: { message: string } }).error.message
            : "ثبت انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success(success);
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  const saveLineup = (): Promise<void> =>
    send(
      `/api/v1/matches/${matchId}/lineup`,
      {
        entries: named.map((member) => {
          const row = state[member.playerId]!;
          return {
            playerId: member.playerId,
            role: row.selection,
            ...(row.shirtNumber
              ? { shirtNumber: Number(row.shirtNumber) }
              : {}),
          };
        }),
      },
      "ترکیب ثبت شد",
    );

  const saveStats = (): Promise<void> =>
    send(
      `/api/v1/matches/${matchId}/stats`,
      {
        entries: named.map((member) => {
          const row = state[member.playerId]!;
          return {
            playerId: member.playerId,
            minutesPlayed: Number(row.minutesPlayed || 0),
            goals: Number(row.goals || 0),
            assists: Number(row.assists || 0),
            yellowCards: Number(row.yellowCards || 0),
            redCards: Number(row.redCards || 0),
          };
        }),
      },
      "آمار مسابقه ثبت شد",
    );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {toPersianDigits(named.length)} بازیکن در ترکیب، از{" "}
        {toPersianDigits(squad.length)} نفر
      </p>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {squad.map((member) => {
          const row = state[member.playerId]!;
          const inSquad = row.selection !== "OUT";

          return (
            <li key={member.playerId} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {member.jerseyNumber ? (
                    <span className="me-2 text-muted-foreground tabular-nums">
                      {toPersianDigits(member.jerseyNumber)}
                    </span>
                  ) : null}
                  {member.firstName} {member.lastName}
                </p>

                {editable ? (
                  <RadioGroupPrimitive.Root
                    dir="rtl"
                    value={row.selection}
                    onValueChange={(next) =>
                      update(member.playerId, { selection: next as Selection })
                    }
                    aria-label={`نقش ${member.firstName} ${member.lastName}`}
                    className="flex overflow-hidden rounded-md border border-border"
                  >
                    {SELECTIONS.map((option) => (
                      <RadioGroupPrimitive.Item
                        key={option.value}
                        value={option.value}
                        className={cn(
                          "border-s border-border px-2.5 py-1 text-xs transition-colors first:border-s-0",
                          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          row.selection === option.value
                            ? SELECTION_CLASS[option.value]
                            : "text-muted-foreground",
                        )}
                      >
                        {option.label}
                      </RadioGroupPrimitive.Item>
                    ))}
                  </RadioGroupPrimitive.Root>
                ) : (
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs",
                      SELECTION_CLASS[row.selection],
                    )}
                  >
                    {SELECTIONS.find((item) => item.value === row.selection)
                      ?.label ?? "خارج"}
                  </span>
                )}
              </div>

              {/* The numbers only appear once there is a match to describe. */}
              {inSquad && statsOpen ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {(
                    [
                      ["minutesPlayed", "دقیقه", 150],
                      ["goals", "گل", 30],
                      ["assists", "پاس گل", 30],
                      ["yellowCards", "زرد", 2],
                      ["redCards", "قرمز", 1],
                    ] as const
                  ).map(([field, label, max]) => (
                    <label key={field} className="flex items-center gap-1">
                      {label}
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={max}
                        disabled={!editable}
                        aria-label={`${label} ${member.firstName} ${member.lastName}`}
                        value={row[field]}
                        onChange={(event) =>
                          update(member.playerId, {
                            [field]: event.target.value,
                          })
                        }
                        className="h-7 w-16"
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void saveLineup()}
          >
            ثبت ترکیب
          </Button>
          {statsOpen ? (
            <Button
              type="button"
              disabled={busy || named.length === 0}
              onClick={() => void saveStats()}
            >
              {busy ? "در حال ثبت…" : "ثبت آمار مسابقه"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
