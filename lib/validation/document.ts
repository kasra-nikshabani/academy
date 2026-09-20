import { z } from "zod";
import { idSchema } from "./common";

/** Document metadata. The file itself is validated by its bytes, not here. */

export const DOCUMENT_TYPES = [
  "ID_DOCUMENT",
  "BIRTH_CERTIFICATE",
  "CONTRACT",
  "MEDICAL",
  "PARENT_CONSENT",
  "PHOTO",
  "OTHER",
] as const;

export const uploadDocumentSchema = z.object({
  personId: idSchema,
  type: z.enum(DOCUMENT_TYPES).default("OTHER"),
  title: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
