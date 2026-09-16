import type {
  ApplicationStatus,
  ScreeningStatus,
  TryoutStatus,
} from "@/lib/generated/prisma/enums";

/** How the talent module reads in Persian. Presentation, not contract. */

export const TRYOUT_STATUS_LABEL: Record<TryoutStatus, string> = {
  DRAFT: "پیش‌نویس",
  OPEN: "ثبت‌نام باز",
  CLOSED: "ثبت‌نام بسته",
  CANCELLED: "لغو شد",
  COMPLETED: "برگزار شد",
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: "ثبت‌شده",
  SCREENING: "در غربالگری",
  EVALUATION: "در ارزیابی",
  ACCEPTED: "پذیرفته شد",
  REJECTED: "پذیرفته نشد",
  WAITLIST: "فهرست انتظار",
  CANCELLED: "لغو شد",
};

export const APPLICATION_STATUS_CLASS: Record<ApplicationStatus, string> = {
  SUBMITTED: "bg-muted text-muted-foreground",
  SCREENING: "bg-brand-muted text-brand-foreground",
  EVALUATION: "bg-brand text-brand-foreground",
  ACCEPTED: "bg-success text-success-foreground",
  REJECTED: "bg-destructive/15 text-destructive",
  WAITLIST: "bg-warning text-warning-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const SCREENING_STATUS_LABEL: Record<ScreeningStatus, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شد",
  REJECTED: "رد شد",
};
