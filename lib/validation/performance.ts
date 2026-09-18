import { z } from "zod";
import {
  METRIC_ORDER,
  PERFORMANCE_METRICS,
  isValueInRange,
  metricDefinition,
} from "@/lib/services/performance-metrics";
import { idSchema } from "./common";

/**
 * Performance measurements.
 *
 * One request records everything measured on one day, because that is how a
 * testing session happens: a squad runs the 20 metres, jumps, and is weighed
 * in one afternoon, and the coach writes the sheet up once.
 *
 * **The range check is per metric, and it has to be.** A single numeric bound
 * wide enough for a Cooper test (thousands of metres) accepts a 20-metre
 * sprint of 900 seconds, and one narrow enough for a sprint rejects every
 * Cooper result there is. The catalogue already knows each metric's plausible
 * range, so the schema asks it rather than repeating it — which also means
 * adding a metric never means remembering to come back here.
 */

export const PERFORMANCE_METRIC_NAMES = METRIC_ORDER as [
  (typeof METRIC_ORDER)[number],
  ...(typeof METRIC_ORDER)[number][],
];

export const performanceEntrySchema = z
  .object({
    metric: z.enum(PERFORMANCE_METRIC_NAMES),
    value: z.coerce.number(),
    notes: z.string().trim().max(400).optional(),
  })
  .superRefine((entry, ctx) => {
    if (isValueInRange(entry.metric, entry.value)) return;

    const definition = metricDefinition(entry.metric);
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `مقدار «${definition.label}» باید بین ${definition.min} تا ${definition.max} ${definition.unit} باشد.`,
    });
  });

export const savePerformanceSchema = z
  .object({
    /**
     * The day of the test, not the day of the paperwork. Defaults to today so
     * a coach entering results at the side of the pitch does not have to say
     * so, and can be back-dated so one entered a week later is still filed
     * against the session it belongs to.
     */
    measuredAt: z.coerce.date().default(() => new Date()),
    trainingSessionId: idSchema.optional(),
    entries: z.array(performanceEntrySchema).min(1).max(METRIC_ORDER.length),
  })
  .refine(
    (input) =>
      new Set(input.entries.map((entry) => entry.metric)).size ===
      input.entries.length,
    {
      path: ["entries"],
      // The database says this too, via the unique key. Saying it here turns a
      // constraint violation into a sentence a coach can act on.
      message: "برای هر سنجه در یک روز فقط یک مقدار قابل ثبت است.",
    },
  );

export const performanceQuerySchema = z.object({
  metric: z.enum(PERFORMANCE_METRIC_NAMES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type PerformanceEntryInput = z.infer<typeof performanceEntrySchema>;
export type SavePerformanceInput = z.infer<typeof savePerformanceSchema>;
export type PerformanceQuery = z.infer<typeof performanceQuerySchema>;

/** Exposed for the form, so the client can bound its own inputs identically. */
export const METRIC_BOUNDS = PERFORMANCE_METRICS;
