import { z } from "zod";
import { idSchema } from "./common";

/**
 * Announcements.
 *
 * Creating is drafting. There is no `publish: true` flag here on purpose:
 * sending to every family in a squad should be a separate, deliberate act
 * rather than a boolean somebody leaves set from the last time.
 */

export const NOTIFICATION_TYPES = [
  "INFO",
  "SUCCESS",
  "WARNING",
  "ALERT",
  "TRAINING",
  "MATCH",
  "ATTENDANCE",
  "EVALUATION",
  "TRYOUT",
  "SYSTEM",
] as const;

/** Types a person may choose. `SYSTEM` is the system's to use, not a writer's. */
export const AUTHORABLE_TYPES = [
  "INFO",
  "SUCCESS",
  "WARNING",
  "ALERT",
  "TRAINING",
  "MATCH",
] as const;

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(3, "عنوان اطلاعیه را بنویسید.").max(160),
    body: z.string().trim().min(5, "متن اطلاعیه را بنویسید.").max(4000),
    type: z.enum(AUTHORABLE_TYPES).default("INFO"),
    teamId: idSchema.optional(),
    schoolId: idSchema.optional(),
    seasonId: idSchema.optional(),
  })
  .refine((input) => !(input.teamId && input.schoolId), {
    path: ["teamId"],
    // The service would resolve this by taking the narrower audience, but a
    // writer who picked both did not decide — better to ask than to guess on
    // their behalf about who hears from the club.
    message: "برای هر اطلاعیه یا تیم را انتخاب کنید یا مدرسه را، نه هر دو.",
  });

export const announcementQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const notificationQuerySchema = z.object({
  /** `?unread=1` — what the inbox filter sends. */
  unreadOnly: z.coerce.boolean().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type AnnouncementQuery = z.infer<typeof announcementQuerySchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
