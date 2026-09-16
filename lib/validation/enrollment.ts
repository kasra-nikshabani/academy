import { z } from "zod";

export const createEnrollmentSchema = z.object({
  playerId: z.string().trim().min(1, "بازیکن را انتخاب کنید."),
  schoolId: z.string().trim().min(1, "مدرسه را انتخاب کنید."),
  /** Defaults to the active season when omitted. */
  seasonId: z.string().trim().min(1).optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "TRANSFERRED", "COMPLETED", "CANCELLED"])
    .default("PENDING"),
  notes: z.string().trim().max(1000).optional(),
});

export const updateEnrollmentSchema = z.object({
  status: z.enum([
    "PENDING",
    "ACTIVE",
    "TRANSFERRED",
    "COMPLETED",
    "CANCELLED",
  ]),
  notes: z.string().trim().max(1000).optional(),
});

export const createMembershipSchema = z.object({
  playerId: z.string().trim().min(1, "بازیکن را انتخاب کنید."),
  teamId: z.string().trim().min(1, "تیم را انتخاب کنید."),
  seasonId: z.string().trim().min(1).optional(),
  /** Exactly one membership per player per season carries this. */
  isPrimary: z.boolean().default(true),
  jerseyNumber: z.coerce.number().int().min(1).max(99).optional(),
  notes: z.string().trim().max(1000).optional(),
  /**
   * Admits a player whose birth year falls outside the team's age band.
   * Requires an administrator and is recorded on the membership
   * (BUSINESS_RULES §4).
   */
  ageException: z.boolean().default(false),
});

export const endMembershipSchema = z.object({
  status: z.enum(["INACTIVE", "RELEASED"]).default("RELEASED"),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;
