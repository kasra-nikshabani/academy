# SEPahan Academy OS

سامانه مدیریت آکادمی باشگاه فولاد مبارکه سپاهان — چندرشته‌ای، چند رده سنی، RTL و Production-Grade.

> **وضعیت فعلی:** فازهای ۰ تا ۱۳ تکمیل شده‌اند.
> ورود با موبایل و OTP، نقش‌ها و مجوزها، ساختار آکادمی، افراد، ثبت‌نام و عضویت، مسیر بازیکن، تمرین، حضور و غیاب، استعدادیابی، و **ارزیابی** —
> همراه با Scope کامل: مربی فقط بازیکنان و تقویم تیم‌های خودش، ولی فقط فرزندان خودش.
> ثبت‌نام استعدادیابی بدون حساب کاربری و با تأیید شماره موبایل انجام می‌شود.
> ارزیابی بازیکن با الگوی قابل تنظیم انجام می‌شود؛ مربی از راه «سپردن ارزیابی» به بازیکن آزمون می‌رسد، بدون دسترسی به خط لوله استعدادیابی.
> قیف استعدادیابی روی همه دوره‌ها، با سه صف کاری: در انتظار غربالگری، در انتظار ارزیاب، در انتظار تصمیم.
> مسابقات با ترکیب و آمار بازیکن؛ ترکیب فقط از بازیکنان همان تیم در همان فصل بسته می‌شود.
> رکوردهای عملکرد از Phase 14 شروع می‌شود.
> نقشه راه در [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Stack

| لایه | فناوری |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5.9 (strict) |
| Database | PostgreSQL 17 + Prisma 7 (pg driver adapter) |
| Validation | Zod 4 |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) |
| Font | Vazirmatn Variable (self-hosted) |
| Tests | Vitest (unit/integration) + Playwright (E2E) |
| Package Manager | pnpm 11 |

معماری **Modular Monolith** است؛ Backend داخل همین Next.js پیاده‌سازی می‌شود.
جزئیات در [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## پیش‌نیازها

- Node.js ≥ 22
- pnpm ≥ 11
- Docker (برای Postgres محلی)

## راه‌اندازی

```bash
pnpm install
cp .env.example .env     # سپس مقادیر را پر کنید
pnpm db:up               # اجرای PostgreSQL روی پورت 5436
pnpm db:generate         # تولید Prisma Client
pnpm db:seed             # حساب‌های ساختگی برای توسعه
pnpm dev                 # http://localhost:3200
```

برای ورود، یکی از شماره‌های Seed را در `/login` وارد کنید؛ کد تأیید در خروجی Dev Server چاپ می‌شود.

| شماره | نقش |
|---|---|
| `09120000001` | مدیر سیستم |
| `09120000002` | مدیر آکادمی |
| `09120000003` | کادر فنی |
| `09120000004` | بازیکن تیم اصلی |
| `09120000005` | ولی |
| `09120000006` | مربی که ولی هم هست |

> پس از هر `pnpm db:migrate`، Dev Server را دوباره راه‌اندازی کنید — نسخه قبلی Prisma Client در حافظه می‌ماند.

بررسی سلامت سیستم:

```bash
curl http://localhost:3200/api/v1/health
```

مرجع Design System: <http://localhost:3200/style-guide>

## دستورها

| دستور | کار |
|---|---|
| `pnpm dev` | اجرای Development Server روی پورت ۳۲۰۰ |
| `pnpm build` | Build نسخه Production |
| `pnpm typecheck` | بررسی TypeScript |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm ui:fix` | اصلاح ایمپورت‌ها پس از `shadcn add` |
| `pnpm test` | تست‌های Unit و Integration |
| `pnpm test:e2e` | تست‌های End-to-End |
| `pnpm verify` | typecheck + lint + test + build |
| `pnpm db:up` / `pnpm db:down` | بالا/پایین آوردن دیتابیس |
| `pnpm db:migrate` | اجرای Migration در Development |
| `pnpm db:seed` | ساخت حساب‌های ساختگی برای توسعه |
| `pnpm db:studio` | Prisma Studio |

## مستندات

| فایل | محتوا |
|---|---|
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | دامنه محصول، نقش‌ها، مسیر بازیکن |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | لایه‌ها، ساختار پوشه‌ها، قواعد وابستگی |
| [`docs/DATABASE.md`](docs/DATABASE.md) | مدل داده، Constraintها، Migration |
| [`docs/API.md`](docs/API.md) | قرارداد API، Envelope، کدهای خطا |
| [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) | RBAC و Scope Authorization |
| [`docs/UI_UX.md`](docs/UI_UX.md) | Design System، توکن‌ها، RTL |
| [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) | قواعد کسب‌وکار |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | فازهای توسعه |
| [`docs/PROJECT_RULES.md`](docs/PROJECT_RULES.md) | قواعد کدنویسی و Git |
| [`docs/SECURITY.md`](docs/SECURITY.md) | مدل تهدید و کنترل‌های امنیتی |

قواعد غیرقابل‌مذاکره پروژه در [`CLAUDE.md`](CLAUDE.md) است.

## داده واقعی

هیچ اطلاعات واقعی بازیکن، والدین یا کادر فنی نباید وارد Git شود. Seed فقط داده ساختگی تولید می‌کند.
