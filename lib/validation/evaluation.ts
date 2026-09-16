import { z } from "zod";
import { idSchema } from "./common";

/** Templates, criteria, and the sheet a coach fills in. */

export const EVALUATION_DIMENSIONS = [
  "TECHNICAL",
  "PHYSICAL",
  "MENTAL",
  "OVERALL",
] as const;

export const EVALUATION_RECOMMENDATIONS = [
  "ACCEPT",
  "WAITLIST",
  "REJECT",
  "MORE_OBSERVATION",
] as const;

export const criterionSchema = z.object({
  dimension: z.enum(EVALUATION_DIMENSIONS),
  title: z.string().trim().min(2, "عنوان معیار را بنویسید.").max(160),
  description: z.string().trim().max(600).optional(),
  maxScore: z.coerce.number().int().min(1).max(100).default(10),
  weight: z.coerce.number().int().min(1).max(10).default(1),
  displayOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export const createTemplateSchema = z.object({
  sportId: idSchema,
  ageGroupId: idSchema.nullable().optional(),
  title: z.string().trim().min(3, "عنوان الگو را بنویسید.").max(200),
  description: z.string().trim().max(2000).optional(),
  criteria: z
    .array(criterionSchema)
    .min(1, "الگوی ارزیابی بدون معیار معنا ندارد.")
    .max(40),
});

/**
 * Asking for an evaluation.
 *
 * The evaluator is named here rather than inferred: an academy manager sends
 * a trial player to a particular coach, and "whoever happens to be free" is
 * not a thing the record should have to guess later.
 */
export const requestEvaluationSchema = z.object({
  playerId: idSchema,
  templateId: idSchema,
  evaluatorId: idSchema,
  applicationId: idSchema.optional(),
  trainingSessionId: idSchema.optional(),
});

export const evaluationScoreSchema = z.object({
  criterionId: idSchema,
  score: z.coerce.number().int().min(0).max(100),
  note: z.string().trim().max(400).optional(),
});

export const saveEvaluationSchema = z.object({
  scores: z.array(evaluationScoreSchema).max(40).default([]),
  recommendation: z.enum(EVALUATION_RECOMMENDATIONS).optional(),
  strengths: z.string().trim().max(1000).optional(),
  weaknesses: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  /**
   * Submitting freezes the evaluation. Kept as part of the same request so a
   * coach saving their last mark and finishing is one action, not two.
   */
  submit: z.boolean().default(false),
});

export const evaluationQuerySchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
  playerId: idSchema.optional(),
  applicationId: idSchema.optional(),
  /** `true` narrows the list to the caller's own assignments. */
  mine: z.boolean().optional(),
});

export type CriterionInput = z.infer<typeof criterionSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type RequestEvaluationInput = z.infer<typeof requestEvaluationSchema>;
export type SaveEvaluationInput = z.infer<typeof saveEvaluationSchema>;
export type EvaluationQuery = z.infer<typeof evaluationQuerySchema>;
