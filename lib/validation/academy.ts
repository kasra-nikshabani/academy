import { z } from "zod";
import { toEnglishDigits } from "@/lib/utils/number";

/** URL segment: lowercase latin, digits and hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .min(2, "شناسه باید حداقل ۲ نویسه باشد.")
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "شناسه فقط می‌تواند شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.",
  );

const persianName = z
  .string()
  .trim()
  .min(2, "نام باید حداقل ۲ نویسه باشد.")
  .max(120);

/**
 * `.optional()` comes **after** `.transform()` on purpose: applied before it,
 * the transform wraps the schema and Zod stops treating the key as optional,
 * so every caller would have to pass `nameEn: undefined` explicitly.
 */
const optionalText = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const jalaliYear = z.coerce
  .number()
  .int()
  .min(1300, "سال نامعتبر است.")
  .max(1500, "سال نامعتبر است.");

// --- sport ------------------------------------------------------------------

export const createSportSchema = z.object({
  slug: slugSchema,
  name: persianName,
  nameEn: optionalText,
  description: optionalText,
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateSportSchema = createSportSchema.partial();

// --- age group --------------------------------------------------------------

export const createAgeGroupSchema = z
  .object({
    sportId: z.string().trim().min(1, "رشته ورزشی را انتخاب کنید."),
    code: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .transform((value) => toEnglishDigits(value).toUpperCase()),
    name: persianName,
    minAge: z.coerce.number().int().min(4, "حداقل سن نامعتبر است.").max(60),
    maxAge: z.coerce.number().int().min(4, "حداکثر سن نامعتبر است.").max(60),
    displayOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.minAge <= value.maxAge, {
    message: "حداقل سن نمی‌تواند بیشتر از حداکثر سن باشد.",
    path: ["minAge"],
  });

export const updateAgeGroupSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .transform((value) => toEnglishDigits(value).toUpperCase())
      .optional(),
    name: persianName.optional(),
    minAge: z.coerce.number().int().min(4).max(60).optional(),
    maxAge: z.coerce.number().int().min(4).max(60).optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.minAge === undefined ||
      value.maxAge === undefined ||
      value.minAge <= value.maxAge,
    {
      message: "حداقل سن نمی‌تواند بیشتر از حداکثر سن باشد.",
      path: ["minAge"],
    },
  );

// --- season -----------------------------------------------------------------

export const createSeasonSchema = z
  .object({
    name: persianName,
    startYear: jalaliYear,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z
      .enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"])
      .default("UPCOMING"),
  })
  .refine((value) => value.startDate < value.endDate, {
    message: "تاریخ شروع باید پیش از تاریخ پایان باشد.",
    path: ["startDate"],
  });

export const updateSeasonSchema = z
  .object({
    name: persianName.optional(),
    startYear: jalaliYear.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.startDate < value.endDate,
    {
      message: "تاریخ شروع باید پیش از تاریخ پایان باشد.",
      path: ["startDate"],
    },
  );

// --- school -----------------------------------------------------------------

export const createSchoolSchema = z.object({
  sportId: z.string().trim().min(1, "رشته ورزشی را انتخاب کنید."),
  slug: slugSchema,
  name: persianName,
  description: optionalText,
  city: optionalText,
  address: optionalText,
  phone: optionalText,
  isActive: z.boolean().default(true),
});

export const updateSchoolSchema = createSchoolSchema.partial().omit({
  sportId: true,
});

// --- team -------------------------------------------------------------------

export const createTeamSchema = z.object({
  sportId: z.string().trim().min(1, "رشته ورزشی را انتخاب کنید."),
  ageGroupId: z.string().trim().min(1, "رده سنی را انتخاب کنید."),
  slug: slugSchema,
  name: persianName,
  description: optionalText,
  isActive: z.boolean().default(true),
});

export const updateTeamSchema = createTeamSchema.partial().omit({
  sportId: true,
});

export type CreateSportInput = z.infer<typeof createSportSchema>;
export type CreateAgeGroupInput = z.infer<typeof createAgeGroupSchema>;
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
