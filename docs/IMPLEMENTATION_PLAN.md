# IMPLEMENTATION_PLAN — SEPahan Academy OS

هر فاز مستقل بررسی و تأیید می‌شود. پس از هر فاز کار **متوقف** می‌شود.

## وضعیت فازها

| فاز | عنوان | وضعیت |
|---|---|---|
| 0 | Foundation | ✅ تکمیل |
| 1 | Design System | ⏳ بعدی |
| 2 | Authentication (Mobile + OTP) | ⛔ |
| 3 | RBAC + Scope | ⛔ |
| 4 | Academy Core (Sport/AgeGroup/Season/School/Team) | ⛔ |
| 5 | Players / Guardians / Staff | ⛔ |
| 6 | Enrollment | ⛔ |
| 7 | Player Journey | ⛔ |
| 8 | Training | ⛔ |
| 9 | Attendance | ⛔ |
| 10 | Tryouts | ⛔ |
| 11 | Evaluation Engine | ⛔ |
| 12 | Talent Pipeline | ⛔ |
| 13 | Matches | ⛔ |
| 14 | Performance | ⛔ |
| 15 | Notifications | ⛔ |
| 16 | Dashboards | ⛔ |
| 17 | Reports | ⛔ |
| 18 | Documents | ⛔ |
| 19 | Audit & Security | ⛔ |
| 20 | Performance Optimization | ⛔ |
| 21 | E2E Testing | ⛔ |
| 22 | Production Deployment | ⛔ |

## Phase 0 — Foundation ✅

**تحویل‌شده:**

- Git با `.gitignore` پیش از اولین Commit؛ Remote متصل
- Next.js 16 + React 19 + TypeScript 5.9 strict (بدون `src/`)
- ESLint با enforce کردن مرزهای معماری + Prettier
- Tailwind 4 + shadcn/ui (Radix، RTL) + توکن‌های برند سپاهان + Vazirmatn
- PostgreSQL 17 در Docker (پورت ۵۴۳۶) + Prisma 7.10.0 با pg adapter
- `lib/`: `env` (Zod)، `errors`، `logger` (با Redaction)، `api` (Envelope/Pagination/Handler)، `db`، اسکلت `storage`
- `GET /api/v1/health` — اثبات زنجیره Service → Repository → Prisma → Postgres
- Vitest (۱۷ تست) + Playwright (۳ تست)
- ده سند در `docs/`

**خارج از محدوده (عمدی):** هیچ Domain Model، هیچ Migration، هیچ احراز هویت، هیچ صفحه واقعی.

## Phase 1 — Design System

Component های Base از shadcn/ui، Layout و Navigation، Skeleton/Empty/Error استاندارد، لایه تبدیل تاریخ جلالی، صفحه Style Guide داخلی.

**خروجی تصمیم‌محور:** پالت نهایی نمودارها.

## Phase 2 — Authentication

مدل‌های `User` و `OtpCode`، اولین Migration، ارسال/تأیید OTP، Session با JWT (`jose`) در Cookie با `httpOnly`، Rate Limiting، صفحات `/login` و `/verify`، `GET /api/v1/me`.

**پیش‌نیاز تصمیم:** قواعد اعتبارسنجی موبایل و کد ملی (`docs/BUSINESS_RULES.md` §10).

## Phase 3 — RBAC + Scope

کاتالوگ مجوزها، `requirePermission`، `assertTeamScope`/`assertChildScope`، تست‌های نفوذ Scope.

## فازهای ۴ تا ۲۲

مطابق فهرست بالا و دامنه تعریف‌شده در `PRODUCT_SPEC.md`. محدوده دقیق هر فاز پیش از شروع آن نوشته و تأیید می‌شود.

## سناریوهای اجباری E2E

تا پایان Phase 21 این ده مسیر باید تست خودکار داشته باشند:

1. ورود با OTP
2. دسترسی بر اساس نقش
3. Scope کادر فنی
4. ایجاد بازیکن
5. ثبت‌نام در مدرسه
6. ثبت درخواست Tryout
7. Transaction پذیرش Tryout
8. حضور و غیاب تمرین
9. ترکیب مسابقه
10. دسترسی والد به فرزند

## تصمیم‌های باز

| موضوع | لازم تا |
|---|---|
| مبنای محاسبه رده سنی | Phase 6 |
| قواعد اعتبارسنجی موبایل و کد ملی | Phase 2 |
| Provider پیامک واقعی | قبل از Production |
| پالت نهایی نمودارها | Phase 14 |
| نصب Docker Compose v2 روی سرور | Phase 22 |
