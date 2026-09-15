# DATABASE — SEPahan Academy OS

PostgreSQL 17 + Prisma 7.

## 1. وضعیت فعلی

اولین Migration در Phase 2 اجرا شد: `20260915085940_identity_user_and_otp`.

| Model | فاز | توضیح |
|---|---|---|
| `User` | ۲ | حساب کاربری؛ کلید یکتا `mobile` |
| `OtpCode` | ۲ | کدهای ورود، به‌صورت Hash |
| `Role` | ۳ | شش نقش سیستمی |
| `Permission` | ۳ | کاتالوگ مجوزها، همگام با کد |
| `UserRole` | ۳ | انتساب نقش — چند نقش برای یک کاربر مجاز است |
| `RolePermission` | ۳ | مجوزهای هر نقش |
| `Sport` | ۴ | رشته ورزشی |
| `AgeGroup` | ۴ | رده سنی — بازه سنی، نه سال تولد |
| `Season` | ۴ | فصل؛ `startYear` مبنای رده سنی است |
| `School` | ۴ | مدرسه ورزشی |
| `Team` | ۴ | تیم؛ به فصل وابسته نیست |

Migration ها: `20260915085940_identity_user_and_otp` · `20260915092307_authorization_roles_and_permissions` · `20260915093922_academy_structure`

Enum ها: `UserStatus` · `OtpPurpose` · `RoleKey` · `SeasonStatus`

### چرا `AgeGroup` سال تولد ذخیره نمی‌کند

سال‌های تولد مجاز هر فصل تغییر می‌کنند. ذخیره‌کردنشان یعنی هر تابستان همه رده‌ها دستی به‌روزرسانی شوند و هر رکوردی که جا بماند بی‌صدا غلط شود. بازه سنی ثابت است؛ سال تولد از روی فصل محاسبه می‌شود (docs/BUSINESS_RULES.md §4).

### چرا `Team` به `Season` وصل نیست

«فوتبال U14» از سالی به سال بعد همان تیم است. اگر تیم فصل داشت، تاریخچه هر تیم هر تابستان دو شاخه می‌شد. فصل روی **عضویت** است، نه روی تیم.

### چرا `UserRole` یک جدول است

چون یک نفر می‌تواند هم‌زمان مربی و ولیِ یکی از بازیکنان باشد — حالتی رایج در آکادمی واقعی. یک ستون `role` روی `User` این را غیرممکن می‌کرد.

### چند تصمیم در مدل `OtpCode`

- `mobile` روی خود رکورد نگه داشته می‌شود، نه فقط از طریق `userId` — چون کد ممکن است برای شماره‌ای بدون حساب درخواست شود و Rate Limit باید بر اساس شماره کار کند
- `codeHash` همیشه `HMAC-SHA256` است؛ کد خام هرگز ذخیره نمی‌شود
- `consumedAt` مصرف یک‌باره را تضمین می‌کند
- `attempts` سقف تلاش را می‌شمارد
- `ipHash` فقط Digest است، نه نشانی خام

### Seed

```bash
pnpm db:seed
```

شش حساب ساختگی می‌سازد (Admin، Manager، Coach، Player، Parent و یک حساب Blocked برای تست). هیچ داده واقعی در Seed نیست.

## 2. نکته مهم Prisma 7

در Prisma 7 فیلد `url` از بلوک `datasource` **حذف شده است**. در نتیجه:

- آدرس اتصال برای CLI و Migrate در `prisma7.config.ts` قرار دارد
- Client در زمان اجرا از **Driver Adapter** (`@prisma/adapter-pg`) استفاده می‌کند — `lib/db.ts`

نسخه Prisma روی `7.10.0` **Pin** شده است، چون تگ `latest` در npm یک Release Candidate ناپایدار (`8.0.0-rc.15`) است.

## 3. اتصال محلی

```bash
pnpm db:up      # postgres:17-alpine روی 127.0.0.1:5436
pnpm db:down
```

پورت ۵۴۳۶ انتخاب شد چون ۵۴۳۲ (نصب محلی) و ۵۴۳۳/۵۴۳۴/۵۴۴۲ (پروژه‌های دیگر روی همین ماشین) اشغال بودند. کانتینر فقط روی Loopback باز است.

## 4. Migration

```bash
pnpm db:migrate              # Development — ساخت و اعمال Migration
pnpm db:generate             # تولید مجدد Client
pnpm db:deploy               # Production — فقط اعمال Migrationهای موجود
pnpm db:studio               # مرور داده
```

Prisma Client داخل `lib/generated/prisma` تولید می‌شود و در `.gitignore` است؛ پس از هر `pnpm install` باید `pnpm db:generate` اجرا شود.

## 5. قواعد طراحی Schema

هنگام افزودن Model ها این‌ها الزامی‌اند:

- Normalize شده، با Relation های صریح
- `createdAt` / `updatedAt` روی هر جدول
- Index روی هر ستونی که در Filter، Sort یا Join استفاده می‌شود
- Unique Constraint ها دقیقاً مطابق §6
- بدون Hard Delete روی داده تاریخی — به‌جای آن Status
- عملیات چندجدولی داخل Transaction

## 6. Unique Constraint های اجباری

| موجودیت | کلید یکتا |
|---|---|
| Person | `nationalCode` |
| Player | `playerCode` |
| SchoolEnrollment | `playerId + schoolId + seasonId` |
| TeamMembership | `playerId + teamId + seasonId` |
| TryoutApplication | `tryoutId + playerId` |
| Attendance | `trainingSessionId + playerId` |
| MatchLineup | `matchId + playerId` |
| PlayerMatchStat | `matchId + playerId` |
| EvaluationScore | `evaluationId + criterionId` |

## 7. ماژول‌های دامنه (برنامه‌ریزی‌شده)

| ماژول | موجودیت‌ها | فاز |
|---|---|---|
| Identity | User, Role, Permission, UserRole, RolePermission, OtpCode | 2–3 |
| Academy | Sport, AgeGroup, Season, School, Team | 4 |
| People | Person, Player, Guardian, PlayerGuardian, Staff, StaffTeam | 5 |
| Enrollment | SchoolEnrollment, TeamMembership | 6 |
| Journey | PlayerJourneyEvent | 7 |
| Training | TrainingSession, TrainingPlan, TrainingExercise, Attendance | 8–9 |
| Talent | Tryout, TryoutApplication, Screening, EvaluationTemplate, EvaluationCriterion, Evaluation, EvaluationScore | 10–12 |
| Competition | Match, MatchLineup, PlayerMatchStat | 13 |
| Performance | PerformanceRecord | 14 |
| Communication | Notification, Announcement | 15 |
| Documents | Document | 18 |
| Audit | AuditLog | 19 |

## 8. تاریخ و زمان

همه Timestampها در دیتابیس **UTC** ذخیره می‌شوند. تبدیل به تقویم جلالی فقط در لایه نمایش انجام می‌شود. این تصمیم در Phase 1 با یک لایه تبدیل مشترک پیاده می‌شود.
