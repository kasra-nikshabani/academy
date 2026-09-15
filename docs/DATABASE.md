# DATABASE — SEPahan Academy OS

PostgreSQL 17 + Prisma 7.

## 1. وضعیت فعلی

`prisma/schema.prisma` فقط `generator` و `datasource` دارد. **هیچ Model تعریف نشده است.**

این عمدی است: Phase 0 فقط زنجیره اتصال و خط لوله Migration را اثبات می‌کند. ساختن Model ساختگی برای «اجرای اولین Migration» بدهی فنی تولید می‌کند، پس اولین Migration همراه با اولین Domain واقعی (Phase 2) ساخته می‌شود.

اثبات اتصال: `tests/integration/health.test.ts` و `GET /api/v1/health`.

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
