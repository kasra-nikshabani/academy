# ARCHITECTURE — SEPahan Academy OS

> وضعیت: Phase 0 اجرا شده. لایه‌ها برپا هستند اما فقط با یک مسیر نمونه (Health) پر شده‌اند.

## 1. تصمیم بنیادی

**Modular Monolith** روی Next.js. Backend و Frontend در یک Repository و یک Deployment واحد هستند.

Microservice ساخته نمی‌شود. دلیل: تیم کوچک، دامنه به‌هم‌پیوسته، و نیاز به Transactionهای چندجدولی (مثل پذیرش Tryout) که در معماری توزیع‌شده پرهزینه می‌شوند.

Java/Spring در این پروژه استفاده نمی‌شود. (پروژه `sepapp` باشگاه جداست و صرفاً از طریق API/SSO با این سیستم مرتبط خواهد شد، نه از طریق اشتراک کد.)

## 2. لایه‌ها

```
Presentation   app/**, components/**      ← Server Components پیش‌فرض
      ↓
API            app/api/v1/**/route.ts     ← Thin؛ فقط Parse + Authorize + Delegate
      ↓
Service        lib/services/**            ← تمام Business Logic
      ↓
Repository     lib/repositories/**        ← فقط Data Access
      ↓
Prisma         lib/db.ts → PostgreSQL
```

جریان هر Request:

```
Request → Validation (Zod) → Authorization (Permission + Scope) → Service → Repository → Prisma → Response Envelope
```

## 3. قواعد وابستگی (توسط ESLint enforce می‌شوند)

| قاعده | پیاده‌سازی |
|---|---|
| UI و Route Handler حق Import کردن `@/lib/repositories` یا `@/lib/db` را ندارند | `eslint.config.mjs` → `academy/layer-boundaries` |
| UI و Route Handler حق Import کردن Runtime از `@prisma/client` را ندارند (فقط `import type`) | همان |
| Repository حق Import کردن `@/lib/services` را ندارد | `academy/repository-layer` |
| `console.*` فقط داخل `lib/logger/logger.ts` مجاز است | `no-console` |
| `any` ممنوع | `@typescript-eslint/no-explicit-any` |

این قواعد عمداً در ابزار قفل شده‌اند تا رعایتشان به Code Review وابسته نباشد.

## 4. مسئولیت هر لایه

### Route Handler
- Body/Query را با Zod Parse می‌کند
- کاربر جاری را resolve می‌کند
- Service را صدا می‌زند
- خروجی را در Envelope استاندارد برمی‌گرداند

**نباید:** شرط کسب‌وکار داشته باشد، مستقیم به Prisma بزند، یا Permission را خودش محاسبه کند.

### Service
- ورودی معتبر را می‌گیرد (فرض می‌کند Validation انجام شده)
- Permission **و** Scope را enforce می‌کند
- چند Repository را هماهنگ می‌کند
- عملیات چندجدولی را در Transaction می‌پیچد
- برای عملیات حساس AuditLog می‌نویسد
- `AppError` پرتاب می‌کند؛ هرگز `Response` نمی‌سازد

**نباید:** `next/server` را Import کند یا مستقیم Cookie بخواند.

### Repository
- Query می‌زند و داده خام برمی‌گرداند
- فقط فیلدهای لازم را Select می‌کند (پرهیز از N+1 و Over-fetch)

**نباید:** Permission چک کند، تصمیم کسب‌وکار بگیرد، یا Audit بنویسد.

## 5. ساختار پوشه‌ها

```text
app/
  (public)/            صفحات عمومی            — Phase 1+
  (auth)/              ورود و تأیید OTP        — Phase 2
  dashboard/           پنل‌های نقش‌محور         — Phase 16+
  (auth)/              ✅ login، verify
  dashboard/           ✅ صفحه موقت پس از ورود (پنل‌های نقش‌محور: Phase 16)
  api/v1/
    health/route.ts    ✅
    auth/otp/send      ✅
    auth/otp/verify    ✅
    auth/logout        ✅
    me/route.ts        ✅
  style-guide/         ✅ مرجع داخلی Design System

components/
  ui/                  ✅ ۳۰ کامپوننت پایه + JalaliCalendar + DatePicker
  states/              ✅ EmptyState، ErrorState، Skeletonها
  layout/              ✅ PageHeader (Navigation در فازهای بعد)
  charts/              Phase 14

lib/
  api/                 ✅ Envelope، Pagination، apiHandler
  auth/                ✅ OTP، Session، کاربر جاری
  db.ts                ✅ Prisma Singleton (pg adapter)
  env.ts               ✅ Env با Zod اعتبارسنجی می‌شود
  errors/              ✅ AppError و کدهای خطا
  logger/              ✅ Logger مرکزی با Redaction
  permissions/         Phase 3
  repositories/        ✅ ساختار + health.repository
  services/            ✅ ساختار + health.service
  storage/             ✅ Interface (پیاده‌سازی Phase 18)
  validation/          ✅ قواعد ایران (موبایل، کد ملی)
  utils/               ✅ cn()، تاریخ جلالی، اعداد فارسی

prisma/
  schema.prisma        ✅ Datasource/Generator (بدون Model)

tests/unit  tests/integration  e2e/
docs/
```

## 6. تصمیم‌های Phase 0 و دلیلشان

| تصمیم | دلیل |
|---|---|
| Prisma **7.10.0** با نسخه Pin شده | تگ `latest` در npm یک RC ناپایدار (`8.0.0-rc.15`) است |
| Prisma **pg driver adapter** | در Prisma 7 فیلد `url` از Schema حذف شده و اتصال مستقیم به Adapter نیاز دارد |
| TypeScript **5.9** به‌جای 7 | نسخه ۷ تازه منتشر شده و بلوغ ابزارهای جانبی اثبات نشده است |
| Logger دست‌ساز به‌جای pino | Redaction نیاز اصلی است و در ~۱۰۰ خط حل می‌شود؛ وابستگی جدید توجیه نداشت |
| `cn` به‌صورت محلی نوشته شد | جلوگیری از وابستگی به یک Micro-package برای ۴ خط کد |
| پورت Dev = **3200** | ۳۰۰۰ و ۳۱۰۰ (Loki) روی این ماشین اشغال‌اند |
| پورت DB = **5436** | ۵۴۳۲/۵۴۳۳/۵۴۳۴/۵۴۴۲ توسط پروژه‌های دیگر گرفته شده‌اند |
| هیچ Model در Schema ساخته نشد | Phase 0 فقط زنجیره اتصال را اثبات می‌کند؛ Model ساختگی بدهی فنی است |

## 6.1 تصمیم‌های Phase 1

| تصمیم | دلیل |
|---|---|
| `jalaali-js` اضافه شد | تبدیل دوطرفه جلالی↔میلادی؛ نمایش با `Intl` انجام می‌شود که وابستگی ندارد |
| `react-day-picker` و `date-fns` حذف شدند | تقویم جلالی اختصاصی نوشته شد؛ این دو بدون مصرف باقی می‌ماندند |
| پکیج `cn` دوباره حذف شد | `shadcn add` آن را برمی‌گرداند؛ `pnpm ui:fix` ایمپورت‌ها را به `@/lib/utils` برمی‌گرداند |
| `Chart` و `DataTable` به تعویق افتادند | بدون مصرف واقعی، طراحی‌شان حدس زدن است (docs/UI_UX.md §9) |
| `lib/utils.ts` به `lib/utils/` تبدیل شد | جا باز کردن برای `date.ts` و `number.ts` مطابق ساختار CLAUDE.md §5 |

## 6.2 تصمیم‌های Phase 2

| تصمیم | دلیل |
|---|---|
| `jose` برای JWT | سبک، بدون وابستگی، و روی Edge Runtime هم کار می‌کند |
| `tsx` به‌عنوان devDependency | Prisma 7 کلاینت را به‌صورت TypeScript با Import بدون پسوند تولید می‌کند؛ `node --experimental-strip-types` نمی‌تواند آن را Resolve کند |
| `pg` به‌عنوان devDependency | Playwright با CommonJS اجرا می‌شود و کلاینت ESM پریزما را نمی‌تواند Load کند؛ آماده‌سازی تست‌های E2E با SQL مستقیم انجام می‌شود |
| Session در Cookie با `httpOnly`، نه `localStorage` | یک باگ XSS نباید بتواند Session را بخواند |
| کاربر در هر درخواست از دیتابیس خوانده می‌شود | Block شدن حساب باید بلافاصله اثر کند، نه پس از انقضای Token |
| `middleware.ts` فقط Redirect است | روی Edge فقط امضای Token دیده می‌شود؛ کنترل دسترسی واقعی در Service و صفحه است |
| شماره موبایل در Cookie، نه در URL | شماره در URL وارد History، لاگ سرور و هدر Referrer می‌شود |

## 7. Runtime

- Server Components پیش‌فرض‌اند؛ Client Component فقط برای Interactivity
- مسیرهایی که به Prisma نیاز دارند `runtime = "nodejs"` اعلام می‌کنند
- Health با `dynamic = "force-dynamic"` از Cache خارج شده است
