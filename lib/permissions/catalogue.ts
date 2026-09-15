/**
 * The permission catalogue.
 *
 * This file is the source of truth: `pnpm db:seed` syncs the `Permission`
 * table to it. Keeping the list in code means a typo in `requirePermission`
 * is a type error rather than a silently-denied request at runtime.
 *
 * Naming is `resource:action`. Actions stay coarse on purpose — a permission
 * per button would be unmanageable across twenty modules, and the fine-grained
 * question ("may they touch *this* record?") is Scope's job, not Permission's.
 */
export const PERMISSIONS = {
  // --- academy structure (Phase 4) ---
  "academy:read": "مشاهده رشته‌ها، رده‌های سنی، فصل‌ها، مدارس و تیم‌ها",
  "academy:write": "ایجاد و ویرایش ساختار آکادمی",

  // --- people (Phase 5) ---
  "player:read": "مشاهده بازیکنان",
  "player:write": "ایجاد و ویرایش بازیکن",
  "guardian:read": "مشاهده اولیا",
  "guardian:write": "ایجاد و ویرایش ولی",
  "staff:read": "مشاهده کادر فنی",
  "staff:write": "ایجاد و ویرایش کادر فنی",

  // --- enrollment (Phase 6) ---
  "enrollment:read": "مشاهده ثبت‌نام مدرسه و عضویت تیم",
  "enrollment:write": "تغییر ثبت‌نام مدرسه و عضویت تیم",

  // --- training & attendance (Phase 8–9) ---
  "training:read": "مشاهده جلسات تمرین",
  "training:write": "ایجاد و ویرایش جلسه تمرین",
  "attendance:read": "مشاهده حضور و غیاب",
  "attendance:write": "ثبت و اصلاح حضور و غیاب",

  // --- talent (Phase 10–12) ---
  "tryout:read": "مشاهده استعدادیابی و درخواست‌ها",
  "tryout:write": "ایجاد و ویرایش Tryout و غربالگری",
  "tryout:decide": "تصمیم نهایی پذیرش یا رد درخواست",
  "evaluation:read": "مشاهده ارزیابی‌ها",
  "evaluation:write": "ثبت و ویرایش ارزیابی",

  // --- competition & performance (Phase 13–14) ---
  "match:read": "مشاهده مسابقات",
  "match:write": "ایجاد و ویرایش مسابقه، ترکیب و آمار",
  "performance:read": "مشاهده رکوردهای عملکرد",
  "performance:write": "ثبت و ویرایش رکورد عملکرد",

  // --- communication & documents (Phase 15, 18) ---
  "notification:read": "مشاهده اعلان‌ها",
  "notification:send": "ارسال اعلان و اطلاعیه",
  "document:read": "مشاهده اسناد",
  "document:write": "بارگذاری و حذف اسناد",

  // --- reporting (Phase 17) ---
  "report:read": "مشاهده گزارش‌های مدیریتی",

  // --- administration ---
  "user:read": "مشاهده کاربران",
  "user:write": "ایجاد و ویرایش کاربر",
  "role:read": "مشاهده نقش‌ها و مجوزها",
  "role:assign": "انتساب نقش به کاربر",
  "audit:read": "مشاهده گزارش‌های Audit",
  "settings:write": "تغییر تنظیمات سیستم",

  // --- personal access ---
  /** Reading and editing one's own record. Everyone signed in holds this. */
  "self:read": "مشاهده اطلاعات شخصی",
  /** A parent reading the players linked to them. Enforced by scope, not here. */
  "child:read": "مشاهده اطلاعات فرزندان",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function splitPermission(permission: Permission): {
  resource: string;
  action: string;
} {
  const [resource, action] = permission.split(":");
  return { resource: resource ?? "", action: action ?? "" };
}
