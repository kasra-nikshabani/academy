import { z } from "zod";
import { idSchema } from "./common";
import { mobileSchema, nationalCodeSchema, otpCodeSchema } from "./iran";

/**
 * Tryouts, applications and screening.
 *
 * The public registration schema is the strictest in the codebase, and
 * deliberately so: it is the one form a stranger can post to, and everything
 * it accepts becomes a `Person` in the academy's records.
 */

export const TRYOUT_STATUSES = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "CANCELLED",
  "COMPLETED",
] as const;

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "EVALUATION",
  "ACCEPTED",
  "REJECTED",
  "WAITLIST",
  "CANCELLED",
] as const;

export const DOMINANT_FEET = ["RIGHT", "LEFT", "BOTH"] as const;

// --- administration ---------------------------------------------------------

export const createTryoutSchema = z
  .object({
    sportId: idSchema,
    ageGroupId: idSchema,
    seasonId: idSchema.optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9-]+$/, "نشانی فقط می‌تواند حروف کوچک، رقم و خط تیره باشد."),
    title: z.string().trim().min(3, "عنوان استعدادیابی را بنویسید.").max(200),
    description: z.string().trim().max(4000).optional(),
    city: z.string().trim().max(100).optional(),
    venue: z.string().trim().max(200).optional(),
    opensAt: z.coerce.date(),
    closesAt: z.coerce.date(),
    heldAt: z.coerce.date().optional(),
    capacity: z.coerce.number().int().min(1).max(10000).optional(),
    status: z.enum(["DRAFT", "OPEN"]).default("DRAFT"),
  })
  .refine((input) => input.opensAt < input.closesAt, {
    message: "پایان ثبت‌نام باید بعد از شروع آن باشد.",
    path: ["closesAt"],
  });

export const updateTryoutSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    venue: z.string().trim().max(200).nullable().optional(),
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    heldAt: z.coerce.date().nullable().optional(),
    capacity: z.coerce.number().int().min(1).max(10000).nullable().optional(),
    status: z.enum(TRYOUT_STATUSES).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

export const tryoutQuerySchema = z.object({
  status: z.enum(TRYOUT_STATUSES).optional(),
  sportId: idSchema.optional(),
});

// --- public registration ----------------------------------------------------

export const tryoutOtpRequestSchema = z.object({ mobile: mobileSchema });

export const tryoutOtpVerifySchema = z.object({
  mobile: mobileSchema,
  code: otpCodeSchema,
});

/**
 * A guardian is required for a child, and that is decided by the date of
 * birth rather than by a checkbox — see `submitTryoutApplication`.
 */
export const applicantGuardianSchema = z.object({
  firstName: z.string().trim().min(2, "نام ولی را بنویسید.").max(80),
  lastName: z.string().trim().min(2, "نام خانوادگی ولی را بنویسید.").max(80),
  mobile: mobileSchema,
  nationalCode: nationalCodeSchema.optional(),
  relation: z
    .enum(["FATHER", "MOTHER", "GRANDPARENT", "SIBLING", "LEGAL_GUARDIAN", "OTHER"])
    .default("FATHER"),
});

export const submitApplicationSchema = z.object({
  firstName: z.string().trim().min(2, "نام را بنویسید.").max(80),
  lastName: z.string().trim().min(2, "نام خانوادگی را بنویسید.").max(80),
  /**
   * Required here, unlike elsewhere in the academy: it is the key that stops
   * the same child being created twice, and a trial registration is exactly
   * where duplicates come from (BUSINESS_RULES §1).
   */
  nationalCode: nationalCodeSchema,
  dateOfBirth: z.coerce.date(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("MALE"),
  city: z.string().trim().max(100).optional(),

  position: z.string().trim().max(60).optional(),
  dominantFoot: z.enum(DOMINANT_FEET).optional(),
  heightCm: z.coerce.number().int().min(80).max(230).optional(),
  weightKg: z.coerce.number().int().min(20).max(200).optional(),
  previousClub: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),

  guardian: applicantGuardianSchema.optional(),
});

export const applicationStatusLookupSchema = z.object({
  trackingCode: z.string().trim().min(6).max(40),
  /**
   * Required alongside the code. The code alone is unguessable, but pairing
   * it with the number means a leaked code on its own still reveals nothing.
   */
  mobile: mobileSchema,
});

// --- screening and decision -------------------------------------------------

export const screeningSchema = z
  .object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
    ageEligible: z.boolean().optional(),
    documentsComplete: z.boolean().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine(
    (input) => input.status !== "REJECTED" || (input.note?.length ?? 0) > 0,
    {
      message: "برای رد کردن در غربالگری، دلیل را بنویسید.",
      path: ["note"],
    },
  );

export const decisionSchema = z
  .object({
    decision: z.enum(["ACCEPTED", "REJECTED", "WAITLIST"]),
    /** Required when accepting: an acceptance puts the player in a squad. */
    teamId: idSchema.optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((input) => input.decision !== "ACCEPTED" || Boolean(input.teamId), {
    message: "برای پذیرش، تیم مقصد را انتخاب کنید.",
    path: ["teamId"],
  });

export type CreateTryoutInput = z.infer<typeof createTryoutSchema>;
export type UpdateTryoutInput = z.infer<typeof updateTryoutSchema>;
export type TryoutQuery = z.infer<typeof tryoutQuerySchema>;
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type ScreeningInput = z.infer<typeof screeningSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
