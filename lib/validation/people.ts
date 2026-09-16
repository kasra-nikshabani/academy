import { z } from "zod";
import { mobileSchema, nationalCodeSchema } from "./iran";

const name = z.string().trim().min(2, "نام باید حداقل ۲ نویسه باشد.").max(80);

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional().or(z.literal("").transform(() => undefined));

export const personSchema = z.object({
  firstName: name,
  lastName: name,
  nationalCode: optional(nationalCodeSchema),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  mobile: optional(mobileSchema),
  email: optional(z.email("ایمیل معتبر نیست.")),
  city: optional(z.string().trim().max(80)),
  address: optional(z.string().trim().max(500)),
});

export const createPlayerSchema = personSchema.extend({
  position: optional(z.string().trim().max(40)),
  jerseyNumber: z.coerce.number().int().min(1).max(99).optional(),
  dominantFoot: z.enum(["RIGHT", "LEFT", "BOTH"]).optional(),
  heightCm: z.coerce.number().int().min(80).max(230).optional(),
  weightKg: z.coerce.number().int().min(20).max(160).optional(),
  medicalNotes: optional(z.string().trim().max(2000)),
});

export const updatePlayerSchema = createPlayerSchema.partial().extend({
  status: z
    .enum(["ACTIVE", "INACTIVE", "INJURED", "TRANSFERRED", "RETIRED"])
    .optional(),
});

export const createGuardianSchema = personSchema.extend({
  occupation: optional(z.string().trim().max(80)),
});

export const linkGuardianSchema = z.object({
  guardianId: z.string().trim().min(1),
  relation: z
    .enum([
      "FATHER",
      "MOTHER",
      "GRANDPARENT",
      "SIBLING",
      "LEGAL_GUARDIAN",
      "OTHER",
    ])
    .default("OTHER"),
  isPrimary: z.boolean().default(false),
});

export const createStaffSchema = personSchema.extend({
  title: optional(z.string().trim().max(80)),
  specialization: optional(z.string().trim().max(80)),
  hiredAt: z.coerce.date().optional(),
});

export const assignStaffTeamSchema = z.object({
  teamId: z.string().trim().min(1, "تیم را انتخاب کنید."),
  role: z
    .enum([
      "HEAD_COACH",
      "ASSISTANT_COACH",
      "GOALKEEPING_COACH",
      "FITNESS_COACH",
      "ANALYST",
      "PHYSIO",
      "TEAM_MANAGER",
      "OTHER",
    ])
    .default("OTHER"),
});

export const playerQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "INJURED", "TRANSFERRED", "RETIRED"])
    .optional(),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
