# API — SEPahan Academy OS

Base path: `/api/v1`

> وضعیت: Health و Authentication پیاده‌سازی شده‌اند. بقیه مسیرها در فازهای بعدی اضافه می‌شوند.

## 1. قرارداد پاسخ

هر پاسخ موفق:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

`meta` اختیاری است و در Endpointهای لیستی حاوی Pagination می‌شود.

هر پاسخ ناموفق:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "پیام قابل‌فهم برای کاربر"
  }
}
```

در خطاهای Validation، فیلد `error.details` آرایه‌ای از `{ field, message }` است.

پیاده‌سازی: `lib/api/response.ts`

## 2. Pagination

پارامترهای Query:

| پارامتر | پیش‌فرض | حداکثر |
|---|---|---|
| `page` | ۱ | — |
| `pageSize` | ۲۰ | ۱۰۰ |

`meta` در پاسخ:

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5
}
```

سقف `pageSize` عمدی است: بدون آن یک درخواست می‌تواند کل جدول بازیکنان را بکشد.

پیاده‌سازی: `lib/api/pagination.ts`

## 3. کدهای خطا

| کد | HTTP | معنی |
|---|---|---|
| `VALIDATION_ERROR` | 422 | ورودی نامعتبر |
| `UNAUTHENTICATED` | 401 | کاربر وارد نشده |
| `FORBIDDEN` | 403 | نقش کاربر این عملیات را ندارد |
| `OUT_OF_SCOPE` | 403 | مجوز هست، اما رکورد خارج از محدوده کاربر است |
| `NOT_FOUND` | 404 | رکورد وجود ندارد |
| `CONFLICT` | 409 | نقض Unique Constraint |
| `RATE_LIMITED` | 429 | عبور از سقف درخواست (به همراه هدر `Retry-After`) |
| `INTERNAL_ERROR` | 500 | خطای پیش‌بینی‌نشده |

`OUT_OF_SCOPE` عمداً از `FORBIDDEN` جدا شده تا نقض Scope مستقلاً قابل Audit باشد.

پیاده‌سازی: `lib/errors/`

## 4. رفتار خطا

- خطاهای ۵xx یک‌بار با `x-request-id` لاگ می‌شوند و جزئیات داخلی هرگز به کلاینت نمی‌رسد
- خطاهای ۴xx بخشی از عملکرد عادی‌اند و فقط در سطح `debug` ثبت می‌شوند

پیاده‌سازی: `lib/api/handler.ts` → `apiHandler()`

## 5. Endpointهای پیاده‌سازی‌شده

### `GET /api/v1/health`

بدون احراز هویت. وضعیت سرویس و اتصال دیتابیس.

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "up",
    "timestamp": "2026-09-15T12:00:00.000Z"
  },
  "meta": { "service": "academy-os" }
}
```

اگر دیتابیس در دسترس نباشد، پاسخ همچنان ۲۰۰ است اما `status` برابر `degraded` و `database` برابر `down` می‌شود — تا Orchestrator بتواند دلیل را بخواند.

### `POST /api/v1/auth/otp/send`

بدون احراز هویت. درخواست کد ورود.

```json
{ "mobile": "09123456789" }
```

پاسخ:

```json
{
  "success": true,
  "data": { "sent": true, "cooldownSeconds": 60, "expiresInSeconds": 120 }
}
```

**پاسخ برای شماره‌ای که حساب ندارد دقیقاً همین است.** پیامکی ارسال نمی‌شود، اما رکورد ثبت می‌شود تا Rate Limit یکسان اعمال شود. هدف این است که کسی نتواند با آزمون‌وخطا بفهمد کدام شماره عضو آکادمی است.

کد تأیید هرگز در پاسخ برنمی‌گردد.

خطاها: `VALIDATION_ERROR` (۴۲۲) · `RATE_LIMITED` (۴۲۹ با هدر `Retry-After`)

### `POST /api/v1/auth/otp/verify`

بدون احراز هویت. تبدیل کد به Session.

```json
{ "mobile": "09123456789", "code": "123456" }
```

پاسخ موفق `{ "success": true, "data": { "userId": "…" } }` و Session به‌صورت Cookie با `httpOnly` ست می‌شود. Token هرگز در Body پاسخ نیست.

**همه حالت‌های شکست یک خطای یکسان می‌دهند** (`UNAUTHENTICATED`): کد اشتباه، کد منقضی، کد مصرف‌شده، عبور از سقف تلاش، و شماره‌ای که اصلاً کد نگرفته. تفکیک آن‌ها راه شناسایی اعضا را باز می‌کند.

### `POST /api/v1/auth/logout`

Cookie را پاک می‌کند. چه کاربر وارد شده باشد چه نه، موفق برمی‌گردد.

### `GET /api/v1/me`

نیازمند Session.

```json
{
  "success": true,
  "data": {
    "id": "…",
    "mobile": "09123456789",
    "status": "ACTIVE",
    "lastLoginAt": "2026-09-15T08:00:00.000Z"
  }
}
```

نقش‌ها و مجوزها در Phase 3 به این پاسخ اضافه می‌شوند.

خطا: `UNAUTHENTICATED` (۴۰۱)

## 6. مسیرهای برنامه‌ریزی‌شده

| گروه | فاز |
|---|---|
| `sports`، `age-groups`، `seasons`، `schools`، `teams` | Phase 4 |
| `players`، `guardians`، `staff` | Phase 5 |
| `enrollments`، `memberships` | Phase 6 |
| `training`، `attendance` | Phase 8–9 |
| `tryouts`، `applications`، `screening`، `decision` | Phase 10 |
| `evaluations` | Phase 11 |
| `matches`، `lineup`، `stats` | Phase 13 |
| `performance` | Phase 14 |
| `notifications` | Phase 15 |
| `dashboard/academy` | Phase 16 |

قرارداد کامل هر گروه هنگام پیاده‌سازی همان فاز به این سند اضافه می‌شود.
