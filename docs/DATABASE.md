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
| `Person` | ۵ | هویت انسان؛ `nationalCode` یکتا |
| `Player` | ۵ | نقش بازیکن؛ `playerCode` یکتا |
| `Guardian` | ۵ | نقش ولی |
| `PlayerGuardian` | ۵ | **همان Scope ولی** — یکتا: `playerId + guardianId` |
| `Staff` | ۵ | نقش کادر فنی |
| `StaffTeam` | ۵ | **همان Scope مربی** — یکتا: `staffId + teamId` |
| `SchoolEnrollment` | ۶ | یکتا: `playerId + schoolId + seasonId` |
| `TeamMembership` | ۶ | یکتا: `playerId + teamId + seasonId` |
| `PlayerJourneyEvent` | ۷ | فقط افزودنی؛ بدون ویرایش و حذف |

Migration ها: `identity_user_and_otp` · `authorization_roles_and_permissions` · `academy_structure` · `people_and_staff_assignment` · `enrollment_school_and_team` · `player_journey_events`

Enum ها: `UserStatus` · `OtpPurpose` · `RoleKey` · `SeasonStatus` · `Gender` · `PlayerStatus` · `StaffStatus` · `StaffTeamRole` · `GuardianRelation` · `EnrollmentStatus` · `MembershipStatus` · `JourneyEventType`

### چرا `Person` از `Player`/`Guardian`/`Staff` جداست

`Person` انسان است؛ `Player`، `Guardian` و `Staff` نقش‌هایی هستند که آن انسان در آکادمی دارد — و یک نفر می‌تواند هم‌زمان چند تا از آن‌ها باشد. مربی‌ای که پدر یکی از بازیکنان هم هست در آکادمی واقعی عادی است، و این همان واقعیتی است که در Phase 3 `UserRole` را به یک جدول تبدیل کرد.

جایگزین این بود که نام، کد ملی و تاریخ تولد روی سه جدول تکرار شوند و کم‌کم با هم اختلاف پیدا کنند.

`Person.userId` هم اختیاری است: بازیکن خردسال ممکن است اصلاً حساب کاربری نداشته باشد، در حالی که ولی‌اش دارد.

### چرا `AgeGroup` سال تولد ذخیره نمی‌کند

سال‌های تولد مجاز هر فصل تغییر می‌کنند. ذخیره‌کردنشان یعنی هر تابستان همه رده‌ها دستی به‌روزرسانی شوند و هر رکوردی که جا بماند بی‌صدا غلط شود. بازه سنی ثابت است؛ سال تولد از روی فصل محاسبه می‌شود (docs/BUSINESS_RULES.md §4).

### چرا `PlayerJourneyEvent` ارجاع آزاد دارد نه Relation

`teamId` و `schoolId` روی رویداد، کلید خارجی نیستند. رویداد باید از حذف یا غیرفعال شدن تیم جان سالم به در ببرد: «پیوستن به فوتبال U14» اتفاقی است که افتاده، حتی اگر آن تیم بعداً برچیده شود.

### چرا رویدادها در Transaction واقعه نوشته می‌شوند

`lib/repositories/transaction.ts` ابزار این کار است. رویدادی که واقعه‌اش ثبت نشده، و واقعه‌ای که رویدادش گم شده، هر دو Timeline را غیرقابل اعتماد می‌کنند — و چون Timeline فقط افزودنی است، اشتباه قابل پاک کردن نیست.

### چرا `SchoolEnrollment` و `TeamMembership` دو جدول جدا هستند

چون دو رابطه مستقل‌اند. بازیکن می‌تواند هم‌زمان در مدرسه باشد و عضو تیم — و پذیرش در تیم نباید ثبت‌نام مدرسه را پایان دهد (BUSINESS_RULES §2). اگر یک جدول با یک ستون «نوع» بودند، این جدایی خیلی زود از بین می‌رفت.

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
| TryoutApplication | `tryoutId + playerId` · و `trackingCode` یکتا |
| Attendance | `trainingSessionId + playerId` |
| TrainingSession | — (به §۹ نگاه کنید) |
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
| Training | TrainingSession, TrainingPlan, TrainingExercise (✅ ۸)، Attendance (✅ ۹) | 8–9 |
| Talent | Tryout, TryoutApplication, Screening (✅ ۱۰)، EvaluationTemplate, EvaluationCriterion, Evaluation, EvaluationScore (۱۱–۱۲) | 10–12 |
| Competition | Match, MatchLineup, PlayerMatchStat | 13 |
| Performance | PerformanceRecord | 14 |
| Communication | Notification, Announcement | 15 |
| Documents | Document | 18 |
| Audit | AuditLog | 19 |

## 8. تاریخ و زمان

همه Timestampها در دیتابیس **UTC** ذخیره می‌شوند. تبدیل به تقویم جلالی فقط در لایه نمایش انجام می‌شود. این تصمیم در Phase 1 با یک لایه تبدیل مشترک پیاده می‌شود.

## 9. چرا `TrainingSession` کلید یکتا ندارد

`teamId + startsAt` کلید یکتای بدیهی به‌نظر می‌رسد و در اولین Migration همین Phase هم گذاشته شد. یک تست آن را برداشت:

> جلسه‌ای که لغو می‌شود، جای خود را آزاد می‌کند — پس ثبت دوباره جلسه در همان ساعت مجاز است.

کلید یکتا نمی‌تواند «مگر اینکه لغو شده باشد» را بیان کند، و Index جزئی (`WHERE status <> 'CANCELLED'`) در Schema پریزما قابل تعریف نیست؛ افزودن دستی‌اش در SQL، Drift دائمی می‌سازد.

جایگزین: بررسی تعارض در Service، داخل Transaction و زیر `pg_advisory_xact_lock` روی همان تیم. این همان مسابقه‌ای را می‌گیرد که کلید یکتا قرار بود بگیرد، و استثنا را هم می‌فهمد.

Migration دوم این فاز (`training_clash_is_checked_not_constrained`) دقیقاً همین تغییر است و عمداً squash نشده تا دلیلش در تاریخچه بماند.

## 10. `timestamp without time zone` — دو قرارداد ناسازگار

Prisma نوع `DateTime` را روی `timestamp without time zone` نگاشت می‌کند و آن را **UTC** می‌خواند. اما `node-postgres` یک `Date` جاوااسکریپتی را با **Offset محلی** روی همان ستون می‌نویسد.

پس هر تاریخی که با SQL مستقیم (`e2e/support/db.ts`) نوشته شود و با Prisma خوانده شود، به اندازه Offset ماشین جابه‌جا می‌شود:

```
new Date("2026-09-16T13:02:00Z")
  ├─ bind as Date  → ذخیره «۱۶:۳۲:۰۰» → Prisma می‌خواند 16:32Z  ✗
  └─ bind as ISO   → ذخیره «۱۳:۰۲:۰۰» → Prisma می‌خواند 13:02Z  ✓
```

**قاعده: در Fixture ها همیشه `date.toISOString()` را Bind کنید، نه خود `Date` را.** تابع `utcParam` در `e2e/support/db.ts` همین کار را می‌کند.

این تله از Phase 5 وجود داشت و تا Phase 9 هیچ تستی آن را نگرفت، چون هیچ تستی به ساعتِ دقیق یک تاریخ حساس نبود. اولین چیزی که آن را آشکار کرد، قاعده «حضور و غیاب برای جلسه‌ای که شروع نشده ثبت نمی‌شود» بود.
