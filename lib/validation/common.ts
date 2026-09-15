import { z } from "zod";

/** Prisma `cuid()` identifiers as they appear in URLs and request bodies. */
export const idSchema = z.string().trim().min(1, "شناسه نامعتبر است.");

export const dateRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((range) => range.from <= range.to, {
    message: "تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.",
    path: ["from"],
  });

export type DateRange = z.infer<typeof dateRangeSchema>;
