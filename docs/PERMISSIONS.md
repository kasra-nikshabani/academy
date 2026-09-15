# PERMISSIONS — SEPahan Academy OS

> وضعیت: پیاده‌سازی در Phase 3. این سند قرارداد هدف را ثابت می‌کند.

## 1. دو بررسی مستقل

هر عملیات حساس دو سؤال جدا دارد که هرگز در هم ادغام نمی‌شوند:

1. **Permission** — آیا این نقش اصولاً اجازه این عمل را دارد؟
2. **Scope** — آیا این رکورد مشخص داخل محدوده این کاربر است؟

مثال: مربی‌ای که `training:write` دارد، همچنان حق ندارد جلسه تمرین تیمی را ویرایش کند که به او Assign نشده است.

کد خطای این دو متفاوت است (`FORBIDDEN` در برابر `OUT_OF_SCOPE`) تا نقض Scope مستقلاً قابل Audit باشد.

## 2. نقش‌ها

| نقش | محدوده |
|---|---|
| **Admin** | کل سیستم |
| **Academy Manager** | کل آکادمی؛ تصمیم‌های عملیاتی |
| **Staff / Coaching Staff** | فقط تیم‌های Assign‌شده |
| **Main Team Player** | اطلاعات شخصی + تیم خودش |
| **School Player** | محدودتر از بازیکن تیم اصلی |
| **Parent** | فقط فرزند/فرزندان خودش |

## 3. قواعد Scope

| کاربر | می‌بیند |
|---|---|
| Staff | فقط `StaffTeam` های خودش |
| Player | فقط رکوردهای مرتبط با `playerId` خودش |
| Parent | فقط بازیکنانی که از طریق `PlayerGuardian` به او متصل‌اند |

**سناریوی اجباری تست:** اگر کاربر ID موجود در URL را به رکورد شخص دیگری تغییر دهد، Backend باید Reject کند. این تست در مجموعه E2E اجباری است و صرفاً به پنهان‌کردن لینک در UI اکتفا نمی‌شود.

## 4. نقطه enforce

Authorization در **Service** انجام می‌شود، نه در Route Handler و نه در Component.

دلیل: یک Service ممکن است از چند مسیر (Route Handler، Server Action، Job) صدا زده شود؛ اگر کنترل در مسیر باشد، هر مسیر جدید یک راه دور زدن است.

UI فقط بر اساس همان مجوزها چیزها را پنهان می‌کند تا تجربه تمیز باشد — این یک کنترل امنیتی حساب نمی‌شود.

## 5. ساختار

```
lib/permissions/
  permissions.ts   کاتالوگ مجوزها (player:read، training:write، …)
  authorize.ts     requirePermission(user, permission)
  scope.ts         assertTeamScope، assertChildScope، assertOwnRecord
```
