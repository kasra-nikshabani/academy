# API — SEPahan Academy OS

Base path: `/api/v1`

> وضعیت: Health، Authentication و Authorization پیاده‌سازی شده‌اند. بقیه مسیرها در فازهای بعدی اضافه می‌شوند.

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

```json
{
  "roles": [{ "key": "STAFF", "name": "کادر فنی" }],
  "permissions": [{ "key": "training:write", "description": "…" }]
}
```

مجوزها برگردانده می‌شوند تا رابط کاربری بتواند چیزهایی را که کاربر نمی‌تواند استفاده کند پنهان کند. این فقط نمایش است — همان بررسی‌ها در لایه Service دوباره اجرا می‌شوند.

خطا: `UNAUTHENTICATED` (۴۰۱)

### `GET /api/v1/users`

نیازمند مجوز `user:read`. صفحه‌بندی‌شده.

```
GET /api/v1/users?page=1&pageSize=20&search=0912
```

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "mobile": "09120000003",
      "status": "ACTIVE",
      "lastLoginAt": "…",
      "roles": ["STAFF"]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 8, "totalPages": 1 }
}
```

خطاها: `FORBIDDEN` (۴۰۳) · `VALIDATION_ERROR` (۴۲۲ — مثلاً `pageSize` بیش از ۱۰۰)

### `GET /api/v1/roles`

نیازمند مجوز `role:read`. فهرست نقش‌ها به‌همراه مجوزهایشان.

### ساختار آکادمی

همه این مسیرها برای خواندن به `academy:read` و برای نوشتن به `academy:write` نیاز دارند.

| مسیر | متدها |
|---|---|
| `/api/v1/sports` | `GET` `POST` |
| `/api/v1/sports/:id` | `GET` `PATCH` `DELETE` |
| `/api/v1/age-groups` | `GET` `POST` — فیلتر `?sportId=` |
| `/api/v1/age-groups/:id` | `GET` `PATCH` `DELETE` |
| `/api/v1/seasons` | `GET` `POST` |
| `/api/v1/seasons/:id` | `PATCH` — با `?activate=true` فصل را جاری می‌کند |
| `/api/v1/schools` | `GET` `POST` — فیلتر `?sportId=` |
| `/api/v1/schools/:id` | `GET` `PATCH` `DELETE` |
| `/api/v1/teams` | `GET` `POST` — صفحه‌بندی‌شده، فیلتر `?sportId=` `?ageGroupId=` |
| `/api/v1/teams/:id` | `GET` `PATCH` `DELETE` |

`?includeInactive=true` رکوردهای غیرفعال را هم برمی‌گرداند.

> **`DELETE` غیرفعال می‌کند، حذف نمی‌کند.** ساختار آکادمی توسط ثبت‌نام‌ها، جلسات تمرین و سوابق مسابقه ارجاع می‌شود؛ حذف یک تیم آن تاریخچه را با خودش می‌برد (CLAUDE.md §2).

پاسخ رده سنی و تیم شامل `birthYears` است که از روی **فصل جاری** محاسبه می‌شود، نه از رکورد خوانده می‌شود:

```json
{ "birthYears": { "from": 1392, "to": 1393, "label": "متولد ۱۳۹۲ تا ۱۳۹۳" } }
```

اگر فصل فعالی نباشد، این فیلد `null` است.

### بازیکنان، اولیا و کادر فنی

| مسیر | متدها | مجوز |
|---|---|---|
| `/api/v1/players` | `GET` `POST` | `player:read` / `player:write` |
| `/api/v1/players/:id` | `GET` `PATCH` | `player:read` / `player:write` |
| `/api/v1/players/:id/guardians` | `POST` | `player:write` |
| `/api/v1/guardians` | `POST` | `guardian:write` |
| `/api/v1/staff` | `GET` `POST` | `staff:read` / `staff:write` |
| `/api/v1/staff/:id` | `GET` | `staff:read` |
| `/api/v1/staff/:id/teams` | `POST` `DELETE` | `staff:write` |

**همه این مسیرها علاوه بر مجوز، Scope هم اعمال می‌کنند:**

- ولی فقط فرزندان خودش را می‌بیند؛ `GET /players/:id` برای فرزند خانواده دیگر `OUT_OF_SCOPE` (۴۰۳) می‌دهد
- مربی فقط کادر تیم‌های خودش را می‌بیند
- `meta.total` در فهرست بازیکنان بر اساس Query محدودشده محاسبه می‌شود، نه کل جدول — وگرنه تعداد کل، وجود رکوردهای پنهان را لو می‌داد
- `medicalNotes` فقط برای کسی که `player:write` دارد برگردانده می‌شود

> `POST /staff/:id/teams` همان نوشتنی است که به مربی دسترسی به یک تیم می‌دهد، پس `staff:write` می‌خواهد — مربی نباید بتواند محدوده خودش را گسترش دهد.

### ثبت‌نام و عضویت

| مسیر | متدها | مجوز |
|---|---|---|
| `/api/v1/enrollments` | `GET` `POST` | `enrollment:read` / `enrollment:write` |
| `/api/v1/enrollments/:id` | `PATCH` | `enrollment:write` |
| `/api/v1/memberships` | `POST` | `enrollment:write` |
| `/api/v1/memberships/:id` | `DELETE` | `enrollment:write` |
| `/api/v1/teams/:id/roster` | `GET` | `enrollment:read` + Scope تیم |
| `/api/v1/players/:id/enrollments` | `GET` | `enrollment:read` + Scope بازیکن |
| `/api/v1/players/:id/memberships` | `GET` | `enrollment:read` + Scope بازیکن |

`POST /memberships` رده سنی را بررسی می‌کند و در صورت ناهم‌خوانی:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "سال تولد بازیکن با رده سنی U14 هم‌خوان نیست.",
    "details": {
      "birthYear": 1388,
      "ageGroup": "U14",
      "allowed": { "from": 1392, "to": 1393 }
    }
  }
}
```

با `ageException: true` و نقش `ADMIN` این بررسی نادیده گرفته می‌شود و استثنا روی `notes` عضویت ثبت می‌شود.

`DELETE /memberships/:id?status=RELEASED|INACTIVE` عضویت را پایان می‌دهد؛ ردیف حذف نمی‌شود.

> بدنه JSON نامعتبر یا خالی `VALIDATION_ERROR` (۴۲۲) می‌دهد، نه ۵۰۰.

### مسیر بازیکن

| مسیر | متد | مجوز |
|---|---|---|
| `/api/v1/players/:id/journey` | `GET` | `player:read` + Scope بازیکن |

پاسخ، رویدادها را از جدید به قدیم برمی‌گرداند و برای هر کدام `meta` با برچسب فارسی و لحن نمایشی دارد:

```json
{
  "id": "…",
  "type": "TEAM_JOINED",
  "title": "پیوستن به فوتبال U14",
  "description": "فصل ۱۴۰۴-۱۴۰۵",
  "occurredAt": "2026-09-15T…",
  "teamId": "…",
  "actorId": "…",
  "meta": { "label": "پیوستن به تیم", "tone": "success" }
}
```

> **هیچ مسیری برای ایجاد، ویرایش یا حذف رویداد وجود ندارد.** رویدادها را سرویس‌هایی می‌نویسند که واقعه را ایجاد می‌کنند، در همان Transaction (docs/BUSINESS_RULES.md §12).

## 6. مسیرهای برنامه‌ریزی‌شده

| گروه | فاز |
|---|---|
| `users/:id/roles` (انتساب نقش) | Phase 6 |
| `training`، `attendance` | Phase 8–9 |
| `tryouts`، `applications`، `screening`، `decision` | Phase 10 |
| `evaluations` | Phase 11 |
| `matches`، `lineup`، `stats` | Phase 13 |
| `performance` | Phase 14 |
| `notifications` | Phase 15 |
| `dashboard/academy` | Phase 16 |

قرارداد کامل هر گروه هنگام پیاده‌سازی همان فاز به این سند اضافه می‌شود.
