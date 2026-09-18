"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { metricColor } from "./performance-meta";
import {
  METRIC_ORDER,
  metricDefinition,
} from "@/lib/services/performance-metrics";
import { toEnglishDigits, toPersianDigits } from "@/lib/utils/number";
import type { PerformanceMetric } from "@/lib/generated/prisma/enums";

export interface MeasurementFormProps {
  playerId: string;
  /** The last reading of each metric, shown as the placeholder. */
  lastKnown?: Partial<Record<PerformanceMetric, number>>;
}

/**
 * Recording a testing day.
 *
 * Every metric on one sheet, all of them optional: a squad that ran the 20
 * metres and jumped but was not weighed should submit those two, and a form
 * that demanded all six would be answered with invented numbers.
 *
 * The date is the **day of the test**, defaulting to today and free to be
 * back-dated, because results are typed up after the session far more often
 * than during it.
 *
 * Plain React state again, for the reason given on the attendance sheet: six
 * independent numeric fields with no cross-field rules do not need a form
 * library, and the bounds shown here are the server's own — the catalogue is
 * imported rather than restated, so the two can never drift.
 */
export function MeasurementForm({ playerId, lastKnown }: MeasurementFormProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [measuredAt, setMeasuredAt] = React.useState<Date | undefined>(
    () => new Date(),
  );
  const [values, setValues] = React.useState<Record<string, string>>({});

  const filled = METRIC_ORDER.filter((metric) => (values[metric] ?? "").trim());

  async function save(): Promise<void> {
    if (filled.length === 0) {
      toast.error("حداقل یک سنجه را وارد کنید.");
      return;
    }
    if (!measuredAt) {
      toast.error("تاریخ اندازه‌گیری را انتخاب کنید.");
      return;
    }

    setSaving(true);
    try {
      const entries = filled.map((metric) => ({
        metric,
        // Persian digits are what a Persian keyboard produces; the server
        // speaks numbers.
        value: Number(toEnglishDigits((values[metric] ?? "").trim())),
      }));

      const invalid = entries.find((entry) => !Number.isFinite(entry.value));
      if (invalid) {
        toast.error(
          `مقدار «${metricDefinition(invalid.metric).label}» عدد نیست.`,
        );
        return;
      }

      const response = await fetch(`/api/v1/players/${playerId}/performance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          measuredAt: measuredAt.toISOString(),
          entries,
        }),
      });

      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error?: { message?: unknown } }).error?.message ===
            "string"
            ? (body as { error: { message: string } }).error.message
            : "ثبت اندازه‌گیری انجام نشد.";
        toast.error(message);
        return;
      }

      toast.success("اندازه‌گیری ثبت شد");
      setValues({});
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-60">
        <Label htmlFor="measured-at" className="mb-1.5 block text-xs">
          تاریخ اندازه‌گیری
        </Label>
        <DatePicker
          id="measured-at"
          value={measuredAt}
          onChange={setMeasuredAt}
          maxDate={new Date()}
          disabled={saving}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRIC_ORDER.map((metric) => {
          const definition = metricDefinition(metric);
          const previous = lastKnown?.[metric];

          return (
            <div key={metric} className="space-y-1.5">
              <Label
                htmlFor={`metric-${metric}`}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: metricColor(metric) }}
                />
                {definition.label}
                <span className="text-muted-foreground">
                  ({definition.unit})
                </span>
              </Label>

              <Input
                id={`metric-${metric}`}
                inputMode="decimal"
                // The field is LTR so a typed number reads the way numbers
                // read. Its placeholder is therefore **digits only**: a
                // Persian word beside a Latin number inside an LTR field is
                // reordered by the bidi algorithm, and «آخرین: 166.5» came out
                // as «آخرین: 66.5» with the leading digit pushed out of view.
                // The Persian hint lives below, in the page's own direction.
                dir="ltr"
                className="text-start tabular-nums"
                disabled={saving}
                placeholder={`${definition.min}–${definition.max}`}
                aria-describedby={
                  previous === undefined ? undefined : `last-${metric}`
                }
                value={values[metric] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [metric]: event.target.value,
                  }))
                }
              />

              {previous === undefined ? null : (
                <p
                  id={`last-${metric}`}
                  className="text-[11px] text-muted-foreground"
                >
                  آخرین اندازه‌گیری:{" "}
                  <span className="tabular-nums">
                    {toPersianDigits(previous.toFixed(definition.decimals))}
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "در حال ثبت…" : "ثبت اندازه‌گیری"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {filled.length === 0
            ? "سنجه‌های اندازه‌گیری‌شده را پر کنید؛ باقی خالی بماند."
            : `${toPersianDigits(filled.length)} سنجه برای ثبت`}
        </p>
      </div>
    </div>
  );
}
