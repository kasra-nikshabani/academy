"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";
import {
  DIMENSION_LABEL,
  DIMENSION_ORDER,
  RECOMMENDATION_LABEL,
} from "./evaluation-meta";
import type {
  EvaluationDimension,
  EvaluationRecommendation,
} from "@/lib/generated/prisma/enums";

export interface SheetCriterion {
  id: string;
  dimension: EvaluationDimension;
  title: string;
  description: string | null;
  maxScore: number;
  weight: number;
}

export interface EvaluationSheetProps {
  evaluationId: string;
  criteria: readonly SheetCriterion[];
  initialScores: ReadonlyArray<{ criterionId: string; score: number }>;
  initial: {
    recommendation: EvaluationRecommendation | null;
    strengths: string | null;
    weaknesses: string | null;
    notes: string | null;
  };
  /** False once submitted: the sheet becomes a record and stops accepting marks. */
  editable: boolean;
}

const RECOMMENDATIONS = [
  "ACCEPT",
  "WAITLIST",
  "MORE_OBSERVATION",
  "REJECT",
] as const;

/**
 * The sheet a coach fills in.
 *
 * Marks are entered per criterion and grouped by the four dimensions the club
 * reports on. Saving and submitting are two buttons over one request: at the
 * side of a pitch the last mark and "done" are one action, but a coach part
 * way through a session needs to be able to put the phone away.
 *
 * Submitting is refused by the server unless every criterion has a mark — an
 * overall averaged over half a sheet would be a different number pretending
 * to be the same one.
 */
export function EvaluationSheet({
  evaluationId,
  criteria,
  initialScores,
  initial,
  editable,
}: EvaluationSheetProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const [scores, setScores] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.id,
        String(
          initialScores.find((item) => item.criterionId === criterion.id)
            ?.score ?? "",
        ),
      ]),
    ),
  );

  const [recommendation, setRecommendation] = React.useState(
    initial.recommendation ?? "",
  );
  const [strengths, setStrengths] = React.useState(initial.strengths ?? "");
  const [weaknesses, setWeaknesses] = React.useState(initial.weaknesses ?? "");
  const [notes, setNotes] = React.useState(initial.notes ?? "");

  const marked = criteria.filter(
    (criterion) => scores[criterion.id]?.trim() !== "",
  ).length;
  const complete = marked === criteria.length;

  async function save(submit: boolean): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/evaluations/${evaluationId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scores: criteria
            .filter((criterion) => scores[criterion.id]?.trim() !== "")
            .map((criterion) => ({
              criterionId: criterion.id,
              score: Number(scores[criterion.id]),
            })),
          ...(recommendation ? { recommendation } : {}),
          ...(strengths.trim() ? { strengths: strengths.trim() } : {}),
          ...(weaknesses.trim() ? { weaknesses: weaknesses.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          submit,
        }),
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
            : "ثبت ارزیابی انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success(submit ? "ارزیابی ثبت نهایی شد" : "پیش‌نویس ذخیره شد");
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {editable ? (
        <p className="text-xs text-muted-foreground">
          {toPersianDigits(marked)} از {toPersianDigits(criteria.length)} معیار
          امتیاز دارد
          {complete ? "" : " — برای ثبت نهایی همه معیارها لازم است"}
        </p>
      ) : null}

      {DIMENSION_ORDER.map((dimension) => {
        const group = criteria.filter(
          (criterion) => criterion.dimension === dimension,
        );
        if (group.length === 0) return null;

        return (
          <fieldset key={dimension} className="space-y-2">
            <legend className="mb-1 text-sm font-medium">
              {DIMENSION_LABEL[dimension]}
            </legend>

            <ul className="divide-y divide-border rounded-lg border border-border">
              {group.map((criterion) => (
                <li
                  key={criterion.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      {criterion.title}
                      {criterion.weight > 1 ? (
                        <Badge variant="outline" className="ms-2">
                          ضریب {toPersianDigits(criterion.weight)}
                        </Badge>
                      ) : null}
                    </p>
                    {criterion.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {criterion.description}
                      </p>
                    ) : null}
                  </div>

                  {editable ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="sr-only">امتیاز {criterion.title}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={criterion.maxScore}
                        aria-label={`امتیاز ${criterion.title}`}
                        value={scores[criterion.id] ?? ""}
                        onChange={(event) =>
                          setScores((current) => ({
                            ...current,
                            [criterion.id]: event.target.value,
                          }))
                        }
                        className="h-8 w-20"
                      />
                      از {toPersianDigits(criterion.maxScore)}
                    </label>
                  ) : (
                    <span className="text-sm font-medium tabular-nums">
                      {scores[criterion.id]
                        ? `${toPersianDigits(scores[criterion.id]!)} / ${toPersianDigits(criterion.maxScore)}`
                        : "—"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="strengths">نقاط قوت</Label>
          <Textarea
            id="strengths"
            rows={3}
            disabled={!editable}
            value={strengths}
            onChange={(event) => setStrengths(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weaknesses">نقاط قابل بهبود</Label>
          <Textarea
            id="weaknesses"
            rows={3}
            disabled={!editable}
            value={weaknesses}
            onChange={(event) => setWeaknesses(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">یادداشت</Label>
        <Textarea
          id="notes"
          rows={2}
          disabled={!editable}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recommendation">نظر ارزیاب</Label>
        <Select
          value={recommendation}
          onValueChange={setRecommendation}
          disabled={!editable}
        >
          <SelectTrigger id="recommendation" className={cn("sm:w-72")}>
            <SelectValue placeholder="انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            {RECOMMENDATIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {RECOMMENDATION_LABEL[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          این نظر مشورتی است؛ تصمیم نهایی پذیرش با مدیر آکادمی است.
        </p>
      </div>

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            ذخیره پیش‌نویس
          </Button>
          <Button
            type="button"
            disabled={busy || !complete}
            onClick={() => void save(true)}
          >
            {busy ? "در حال ثبت…" : "ثبت نهایی ارزیابی"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
