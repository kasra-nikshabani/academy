# IMPLEMENTATION_PLAN — SEPahan Academy OS

هر فاز مستقل بررسی و تأیید می‌شود. پس از هر فاز کار **متوقف** می‌شود.

## وضعیت فازها

| فاز | عنوان | وضعیت |
|---|---|---|
| 0 | Foundation | ✅ تکمیل |
| 1 | Design System | ✅ تکمیل |
| 2 | Authentication (Mobile + OTP) | ✅ تکمیل |
| 3 | RBAC + Scope | ✅ تکمیل |
| 4 | Academy Core (Sport/AgeGroup/Season/School/Team) | ✅ تکمیل |
| 5 | Players / Guardians / Staff | ✅ تکمیل |
| 6 | Enrollment | ✅ تکمیل |
| 7 | Player Journey | ⏳ بعدی |
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

## Phase 1 — Design System ✅

**تحویل‌شده:**

- ۳۰ کامپوننت پایه از shadcn/ui با پیکربندی RTL
- لایه کامل تاریخ جلالی (`lib/utils/date.ts`) + اعداد فارسی (`lib/utils/number.ts`)
- `JalaliCalendar` و `DatePicker` اختصاصی — شنبه‌محور، ارقام فارسی، قابل پیمایش با کیبورد
- `EmptyState`، `ErrorState`، سه الگوی Skeleton، `PageHeader`
- صفحه `/style-guide` به‌عنوان مرجع زنده Design System
- ۲۲ تست واحد جدید (جمعاً ۳۹) + ۷ تست E2E جدید (جمعاً ۱۰)
- رفع دو باگ Bidi که در بازبینی بصری پیدا شدند

**خارج از محدوده (عمدی):** `Chart` و Recharts (Phase 14)، `DataTable` (Phase 5)، Navigation نقش‌محور (Phase 3+).

## Phase 2 — Authentication ✅

**تحویل‌شده:**

- مدل‌های `User` و `OtpCode` + اولین Migration
- قواعد اعتبارسنجی ایران: موبایل و کد ملی با رقم کنترلی (`docs/BUSINESS_RULES.md` §10)
- کد OTP با `HMAC-SHA256` ذخیره می‌شود، مصرف یک‌باره، سقف تلاش، Cooldown و سقف ساعتی برای شماره و IP
- پاسخ یکسان برای شماره‌های بدون حساب، تا عضویت افراد قابل شناسایی نباشد
- Session با JWT (`jose`) در Cookie با `httpOnly`؛ کاربر در هر درخواست از دیتابیس خوانده می‌شود
- صفحات `/login` و `/verify` و یک `/dashboard` موقت
- `GET /api/v1/me` · `POST /api/v1/auth/logout`
- Seed با شش حساب ساختگی
- ۲۹ تست جدید (جمعاً ۸۰) + ۷ تست E2E جدید (جمعاً ۱۷)

**خارج از محدوده (عمدی):** نقش و مجوز (Phase 3)، پنل‌های نقش‌محور (Phase 16)، Provider واقعی پیامک.

## Phase 3 — RBAC + Scope ✅

**تحویل‌شده:**

- `Role`، `Permission`، `UserRole`، `RolePermission` + Migration دوم
- کاتالوگ ۳۶ مجوز در کد، همگام‌شده با دیتابیس توسط Seed
- شش نقش سیستمی با مجوزهای پیش‌فرض
- **چند نقش برای یک کاربر** — Seed یک مربی که ولی هم هست دارد
- `requirePermission` / `requireRole` / `assertSelf` در لایه Service
- نقش‌ها و مجوزها در `GET /api/v1/me`
- دو Endpoint محافظت‌شده به‌عنوان اثبات: `GET /api/v1/users` (صفحه‌بندی‌شده) و `GET /api/v1/roles`
- `<Can>` برای پنهان‌سازی UI، با تست E2E که اثبات می‌کند پنهان‌سازی کنترل امنیتی نیست
- ۱۷ تست واحد و ۱۵ تست Integration جدید (جمعاً ۱۱۶) + ۹ تست E2E جدید (جمعاً ۲۶)

**خارج از محدوده — و دلیلش:**

محدودسازی مربی به تیم‌هایش و ولی به فرزندانش به `StaffTeam` و `PlayerGuardian` نیاز دارد که تا Phase 5 وجود ندارند. قرارداد آن‌ها (`ScopeFilter`) الان تعریف شده تا بعداً وصله نشود، اما خود Predicate ها همراه با مدل‌هایشان می‌آیند. تا آن زمان هیچ Endpoint تیم‌محوری وجود ندارد که بدون Scope رها شده باشد.

## Phase 4 — Academy Core ✅

**تحویل‌شده:**

- `Sport`، `AgeGroup`، `Season`، `School`، `Team` + Migration سوم
- **منطق رده سنی بر اساس سال تولد** — بازه سنی ذخیره می‌شود، سال‌های تولد مجاز از روی فصل جاری محاسبه می‌شوند
- فقط یک فصل `ACTIVE` در هر زمان، با Transaction
- CRUD کامل برای هر پنج موجودیت با `academy:read` / `academy:write`
- `DELETE` غیرفعال می‌کند، حذف نمی‌کند
- نگاشت خطاهای Prisma به Envelope استاندارد (`P2002` → `CONFLICT` به‌جای ۵۰۰)
- پوسته پنل با Sidebar مشکی و Navigation نقش‌محور
- **اولین `DataTable` واقعی** (از Phase 1 به تعویق افتاده بود) + پنج صفحه مدیریتی
- Seed: دو رشته، هفت رده سنی، دو فصل، یک مدرسه، پنج تیم
- ۲۴ تست جدید (جمعاً ۱۴۰) + ۸ تست E2E جدید (جمعاً ۳۴)

**خارج از محدوده (عمدی):** فرم‌های ایجاد/ویرایش در UI — API کامل است و تست دارد، اما ساخت فرم برای هر پنج موجودیت بدون داشتن بازیکن، زودهنگام بود. صفحات فعلاً فقط نمایشی‌اند.

## Phase 5 — Players / Guardians / Staff ✅

**تحویل‌شده:**

- `Person` · `Player` · `Guardian` · `PlayerGuardian` · `Staff` · `StaffTeam` + Migration چهارم
- **Scope تیم‌محور و فرزندمحور** — همان چیزی که Phase 3 عمداً به تعویق انداخت
- `resolveScope` که کاربر را به مجموعه رکوردهای قابل دسترسش تبدیل می‌کند
- فیلتر Scope **داخل Query** اعمال می‌شود، نه بعد از آن
- جلوگیری از بازیکن تکراری بر اساس کد ملی (BUSINESS_RULES §1)
- `medicalNotes` فقط برای دارندگان `player:write`
- صفحات بازیکنان (فهرست + پرونده) و کادر فنی
- Seed: ۲ مربی روی دو تیم متفاوت، ۴ بازیکن، ۱ ولی متصل به یک فرزند
- ۱۶ تست جدید (جمعاً ۱۵۶) + ۷ تست E2E نفوذ (جمعاً ۴۱)

**یک اصلاح طراحی:** مجوز `child:read` حذف شد. خواندن پرونده فرزند دقیقاً خواندن پرونده بازیکن است؛ دو مجوز برای یک عمل باعث می‌شد ولی بی‌صدا دسترسی‌اش را از دست بدهد. حالا ولی `player:read` دارد و Scope او را محدود می‌کند.

**خارج از محدوده (عمدی):** `TeamMembership` (Phase 6) — تا آن نباشد، بازیکنانِ *تیم* یک مربی قابل استخراج نیست، پس مربی فعلاً فقط رکوردهایی را می‌بیند که شخصاً به آن‌ها متصل است. این یعنی بسته، نه باز.

## Phase 6 — Enrollment ✅

**تحویل‌شده:**

- `SchoolEnrollment` و `TeamMembership` + Migration پنجم
- **Scope مربی گسترش یافت**: از «تیم‌های من» به «بازیکنان تیم‌های من»، از طریق `TeamMembership`
- اعتبارسنجی رده سنی هنگام عضویت، با استثنای فقط-مدیر که روی رکورد ثبت می‌شود
- عضویت در چند تیم مجاز، با دقیقاً یک تیم اصلی در هر فصل
- پایان عضویت با `leftAt`؛ ردیف حذف نمی‌شود و دسترسی مربی قطع می‌شود
- ثبت‌نام مدرسه با پیوستن به تیم پایان **نمی‌یابد** — تست دارد
- صفحه ترکیب تیم + تاریخچه ثبت‌نام و عضویت در پرونده بازیکن
- ۱۸ تست جدید (جمعاً ۱۷۴) + ۷ تست E2E جدید (جمعاً ۴۸)

**سه اصلاح در سلامت تست‌ها:**

۱. بدنه JSON خالی یا نامعتبر ۵۰۰ می‌داد؛ حالا `VALIDATION_ERROR`.
۲. Fixture های E2E کد ملی را از `process.pid` می‌ساختند، پس با بازچرخش pid تکراری می‌شد و چند اجرا بعد به‌صورت متناوب شکست می‌خورد. کد ملی از Fixture ها حذف شد.
۳. فایل‌های تست به‌صورت موازی اجرا می‌شدند و روی داده Seed مشترک می‌نوشتند؛ حالا سریالی اجرا می‌شوند.

## Phase 7 — Player Journey ⏳

`PlayerJourneyEvent` — Timeline مسیر بازیکن از ثبت‌نام تا تیم اصلی.

## فازهای ۴ تا ۲۲

مطابق فهرست بالا و دامنه تعریف‌شده در `PRODUCT_SPEC.md`. محدوده دقیق هر فاز پیش از شروع آن نوشته و تأیید می‌شود.

## سناریوهای اجباری E2E

تا پایان Phase 21 این ده مسیر باید تست خودکار داشته باشند:

1. ورود با OTP ✅
2. دسترسی بر اساس نقش ✅
3. Scope کادر فنی ✅
4. ایجاد بازیکن ✅
5. ثبت‌نام در مدرسه ✅
6. ثبت درخواست Tryout
7. Transaction پذیرش Tryout
8. حضور و غیاب تمرین
9. ترکیب مسابقه
10. دسترسی والد به فرزند ✅

## تصمیم‌های باز

| موضوع | لازم تا |
|---|---|
| Provider پیامک واقعی | قبل از Production |
| پالت نهایی نمودارها | Phase 14 |
| زمان افزودن Recharts | Phase 14 |
| نصب Docker Compose v2 روی سرور | Phase 22 |
