import { z } from "zod";

/**
 * Training sessions, plans and exercises.
 *
 * A session is given a **start and a duration**, not a start and an end: that
 * is how a coach thinks about it, and it makes "90 minutes" impossible to
 * enter backwards. The end is derived once, in the service, and stored — so
 * the database can answer "does this clash?" itself.
 */

export const TRAINING_TYPES = [
  "TECHNICAL",
  "PHYSICAL",
  "TACTICAL",
  "RECOVERY",
  "MIXED",
  "OTHER",
] as const;

export const TRAINING_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;

/** Shorter than a quarter of an hour is a note, not a session. */
export const MIN_SESSION_MINUTES = 15;
/** Five hours. Anything longer is almost always a typo in the duration field. */
export const MAX_SESSION_MINUTES = 300;

const durationSchema = z.coerce
  .number()
  .int()
  .min(MIN_SESSION_MINUTES, `کمترین مدت جلسه ${MIN_SESSION_MINUTES} دقیقه است.`)
  .max(
    MAX_SESSION_MINUTES,
    `بیشترین مدت جلسه ${MAX_SESSION_MINUTES} دقیقه است.`,
  );

export const createTrainingSessionSchema = z.object({
  teamId: z.string().trim().min(1, "تیم را انتخاب کنید."),
  /** The plan the session follows. Optional — a session may have none. */
  planId: z.string().trim().min(1).optional(),
  type: z.enum(TRAINING_TYPES).default("MIXED"),
  /**
   * A session is created either as a draft or on the calendar. It cannot be
   * *born* completed or cancelled: those describe what became of a session
   * that existed first.
   */
  status: z.enum(["DRAFT", "SCHEDULED"]).default("SCHEDULED"),
  startsAt: z.coerce.date(),
  durationMinutes: durationSchema.default(90),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * The team is deliberately absent: a session does not move between teams.
 *
 * Moving one would carry it out of the coach's scope — and, from Phase 9, take
 * attendance for one squad and file it under another.
 */
export const updateTrainingSessionSchema = z
  .object({
    planId: z.string().trim().min(1).nullable().optional(),
    type: z.enum(TRAINING_TYPES).optional(),
    status: z.enum(["DRAFT", "SCHEDULED", "COMPLETED"]).optional(),
    startsAt: z.coerce.date().optional(),
    durationMinutes: durationSchema.optional(),
    location: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

export const cancelTrainingSessionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const trainingSessionQuerySchema = z.object({
  teamId: z.string().trim().min(1).optional(),
  status: z.enum(TRAINING_STATUSES).optional(),
  /** Inclusive window on the session start, for the calendar. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// --- plans and exercises ----------------------------------------------------

export const trainingExerciseSchema = z.object({
  title: z.string().trim().min(1, "عنوان تمرین را بنویسید.").max(200),
  description: z.string().trim().max(2000).optional(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SESSION_MINUTES)
    .optional(),
  focus: z.string().trim().max(120).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export const createTrainingPlanSchema = z.object({
  /**
   * Null or omitted means the plan belongs to the academy rather than to one
   * team. Only an unscoped caller may write one — see the service.
   */
  teamId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1, "عنوان برنامه را بنویسید.").max(200),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(TRAINING_TYPES).default("MIXED"),
  /** Exercises may arrive with the plan, so the whole thing lands at once. */
  exercises: z.array(trainingExerciseSchema).max(50).optional(),
});

export const updateTrainingPlanSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    type: z.enum(TRAINING_TYPES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

export const updateTrainingExerciseSchema = trainingExerciseSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

export type CreateTrainingSessionInput = z.infer<
  typeof createTrainingSessionSchema
>;
export type UpdateTrainingSessionInput = z.infer<
  typeof updateTrainingSessionSchema
>;
export type TrainingSessionQuery = z.infer<typeof trainingSessionQuerySchema>;
export type CreateTrainingPlanInput = z.infer<typeof createTrainingPlanSchema>;
export type UpdateTrainingPlanInput = z.infer<typeof updateTrainingPlanSchema>;
export type TrainingExerciseInput = z.infer<typeof trainingExerciseSchema>;
