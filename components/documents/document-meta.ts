import type { DocumentType } from "@/lib/generated/prisma/enums";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { toPersianDigits } from "@/lib/utils/number";

export { DOCUMENT_TYPE_LABEL };

/**
 * Presentation-only: how each kind of document is marked.
 *
 * `MEDICAL` is the one that stands out, because it is the one a coach cannot
 * open — the badge is a reminder to whoever *can* that the file is narrower
 * than the rest.
 */
export const DOCUMENT_TYPE_CLASS: Record<DocumentType, string> = {
  ID_DOCUMENT: "bg-secondary text-secondary-foreground",
  BIRTH_CERTIFICATE: "bg-secondary text-secondary-foreground",
  CONTRACT: "bg-brand text-brand-foreground",
  MEDICAL: "bg-destructive/15 text-destructive",
  PARENT_CONSENT: "bg-success text-success-foreground",
  PHOTO: "bg-muted text-muted-foreground",
  OTHER: "bg-muted text-muted-foreground",
};

/**
 * Bytes as a person reads them.
 *
 * Persian digits, because this is on screen. The inverse rule applies to the
 * report exports, where the reader is a spreadsheet (lib/reports/csv.ts) — the
 * two are different audiences and the digits follow the audience.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) {
    return `${toPersianDigits((bytes / 1024).toFixed(0))} کیلوبایت`;
  }
  return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}
