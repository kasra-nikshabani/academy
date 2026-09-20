import { z } from "zod";
import { idSchema } from "./common";

/**
 * Report filters.
 *
 * Every field is optional: the useful default is "this season, every team I
 * can reach", which is what a manager wants before they narrow anything.
 */

export const REPORT_SLUGS = [
  "attendance",
  "matches",
  "roster",
  "applications",
] as const;

export const reportQuerySchema = z.object({
  teamId: idSchema.optional(),
  seasonId: idSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const reportSlugSchema = z.enum(REPORT_SLUGS);

/** `?format=csv` downloads; anything else renders the preview. */
export const reportFormatSchema = z.enum(["json", "csv"]).default("json");

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportSlugInput = z.infer<typeof reportSlugSchema>;
