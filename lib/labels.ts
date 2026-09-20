import type {
  ApplicationStatus,
  AttendanceStatus,
  EvaluationDimension,
  EvaluationRecommendation,
  EvaluationStatus,
  HomeAway,
  NotificationType,
  PlayerStatus,
  ScreeningStatus,
  TrainingStatus,
  TrainingType,
  TryoutStatus,
} from "@/lib/generated/prisma/enums";
import type { MatchOutcome } from "@/lib/services/match-result";

/**
 * What each enum is called in Persian.
 *
 * These lived beside the components that first needed them, described as
 * "presentation, not contract". That was right about the *colours* and wrong
 * about the *words*: «حاضر» is what the club calls a `PRESENT` row, and it is
 * the same word on a badge, in a CSV a manager sends to the federation, and in
 * the body of a notification.
 *
 * Phase 17 is what made the difference matter — a report is rendered on the
 * server into a file, and `lib/` cannot reach into `components/` without
 * inverting the layering. So the vocabulary moved here and the component meta
 * files re-export it; the class maps stayed where they were, because a colour
 * really is a design decision.
 */

// --- training ---------------------------------------------------------------

export const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  TECHNICAL: "فنی",
  PHYSICAL: "بدنی",
  TACTICAL: "تاکتیکی",
  RECOVERY: "ریکاوری",
  MIXED: "ترکیبی",
  OTHER: "سایر",
};

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  DRAFT: "پیش‌نویس",
  SCHEDULED: "برنامه‌ریزی‌شده",
  COMPLETED: "برگزار شد",
  CANCELLED: "لغو شد",
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "حاضر",
  LATE: "تأخیر",
  ABSENT: "غایب",
  EXCUSED: "موجه",
};

// --- talent -----------------------------------------------------------------

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

export const SCREENING_STATUS_LABEL: Record<ScreeningStatus, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شد",
  REJECTED: "رد شد",
};

// --- evaluation -------------------------------------------------------------

export const DIMENSION_LABEL: Record<EvaluationDimension, string> = {
  TECHNICAL: "فنی",
  PHYSICAL: "بدنی",
  MENTAL: "ذهنی",
  OVERALL: "کلی",
};

export const EVALUATION_STATUS_LABEL: Record<EvaluationStatus, string> = {
  DRAFT: "در انتظار تکمیل",
  SUBMITTED: "ثبت نهایی شد",
};

export const RECOMMENDATION_LABEL: Record<EvaluationRecommendation, string> = {
  ACCEPT: "پیشنهاد پذیرش",
  WAITLIST: "فهرست انتظار",
  REJECT: "پیشنهاد عدم پذیرش",
  MORE_OBSERVATION: "نیاز به مشاهده بیشتر",
};

// --- competition ------------------------------------------------------------

export const MATCH_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "برنامه‌ریزی‌شده",
  LIVE: "در حال برگزاری",
  COMPLETED: "برگزار شد",
  POSTPONED: "به تعویق افتاد",
  CANCELLED: "لغو شد",
};

export const HOME_AWAY_LABEL: Record<HomeAway, string> = {
  HOME: "خانه",
  AWAY: "خارج از خانه",
  NEUTRAL: "زمین بی‌طرف",
};

export const OUTCOME_LABEL: Record<MatchOutcome, string> = {
  WIN: "برد",
  DRAW: "مساوی",
  LOSS: "باخت",
};

export const LINEUP_ROLE_LABEL = {
  STARTER: "ترکیب اصلی",
  SUBSTITUTE: "ذخیره",
} as const;

// --- people -----------------------------------------------------------------

export const PLAYER_STATUS_LABEL: Record<PlayerStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  INJURED: "مصدوم",
  TRANSFERRED: "منتقل‌شده",
  RETIRED: "بازنشسته",
};

// --- communication ----------------------------------------------------------

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  INFO: "اطلاع",
  SUCCESS: "موفقیت",
  WARNING: "هشدار",
  ALERT: "مهم",
  TRAINING: "تمرین",
  MATCH: "مسابقه",
  ATTENDANCE: "حضور و غیاب",
  EVALUATION: "ارزیابی",
  TRYOUT: "استعدادیابی",
  SYSTEM: "سامانه",
};
