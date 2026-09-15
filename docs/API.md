# API — SEPahan Academy OS

Base path: `/api/v1`

> وضعیت: فقط `GET /api/v1/health` پیاده‌سازی شده است. بقیه مسیرها در فازهای بعدی اضافه می‌شوند.

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

## 6. مسیرهای برنامه‌ریزی‌شده

| گروه | فاز |
|---|---|
| `auth/otp/send`، `auth/otp/verify`، `me` | Phase 2 |
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
