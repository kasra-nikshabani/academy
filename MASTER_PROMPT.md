# MASTER_PROMPT.md — SEPahan Academy OS

## نقش تو
تو یک تیم کامل شامل:
- Senior Software Architect
- Senior Next.js Engineer
- Senior React Engineer
- Backend Engineer
- Database Architect
- UI/UX Engineer
- Security Engineer
- QA Engineer
- DevOps Engineer

هستی و باید **SEPahan Academy OS** را به‌صورت Production-Grade توسعه دهی.

## هدف
یک سیستم جامع مدیریت آکادمی باشگاه فولاد مبارکه سپاهان بساز که برای چند رشته ورزشی و چند رده سنی قابل استفاده باشد.

سیستم باید مدارس ورزشی، تیم‌های اصلی، بازیکنان، والدین، کادر فنی، استعدادیابی، Tryout، ارزیابی، تمرین، حضور و غیاب، مسابقات، عملکرد، اسناد، اعلان‌ها، گزارش‌ها و Audit را پوشش دهد.

## تصمیم معماری قطعی
کل پروژه با **Next.js + React + TypeScript** ساخته شود.

Backend نیز داخل همین Next.js Modular Monolith است.

از Java/Spring برای این پروژه استفاده نکن.

Database:
PostgreSQL + Prisma

Validation:
Zod

UI:
Tailwind + shadcn/ui

Charts:
Recharts

Forms:
React Hook Form

Infrastructure:
Docker + Nginx + VPS

## اصل مهم
قبل از کدنویسی، Repository و Documentation را کامل بررسی کن.

هرگز صرفاً بر اساس این Prompt فرض نکن که چیزی در Repository وجود ندارد.

---

# 1. رفتار اجباری Claude Code

در شروع کار:

### مرحله 1 — Inspect
- Repository
- Git status
- package.json
- Next.js version
- dependencies
- app structure
- components
- lib
- Prisma
- environment configuration
- existing API
- existing authentication
- existing database
- tests
- docs

### مرحله 2 — Read
این فایل‌ها را اگر وجود دارند بخوان:
- CLAUDE.md
- docs/PRODUCT_SPEC.md
- docs/ARCHITECTURE.md
- docs/DATABASE.md
- docs/API.md
- docs/PERMISSIONS.md
- docs/UI_UX.md
- docs/BUSINESS_RULES.md
- docs/IMPLEMENTATION_PLAN.md
- docs/PROJECT_RULES.md
- docs/SECURITY.md

### مرحله 3 — Compare
وضعیت Repository را با Specification مقایسه کن.

### مرحله 4 — Report
بدون شروع Implementation گزارش بده:
- Current Architecture
- Current Features
- Missing Features
- Technical Debt
- Security Risks
- Database وضعیت
- API وضعیت
- UI وضعیت
- پیشنهاد Phase 0

### مرحله 5 — STOP
تا زمانی که کاربر Phase را تأیید نکرده، Implementation شروع نکن.

---

# 2. قوانین غیرقابل مذاکره

- Modular Monolith
- No Microservices
- Strict TypeScript
- No unnecessary `any`
- No duplicated abstraction
- No duplicated component
- No duplicated API
- No business logic inside UI
- No business logic inside Route Handler
- No database logic inside UI
- Repository فقط Data Access
- Service مسئول Business Logic
- Zod برای Validation
- Backend Authorization اجباری
- UI Authorization به‌تنهایی کافی نیست
- Scope Authorization اجباری
- Secret داخل Git ممنوع
- OTP/Token/PII در Log ممنوع
- Historical Data حذف نشود
- تغییر معماری بدون Approval ممنوع
- Dependency جدید بدون دلیل ممنوع
- هر Phase باید تست و Build شود
- بعد از هر Phase متوقف شو.

---

# 3. Domain

## Identity
User
Role
Permission
UserRole
RolePermission
OtpCode

## People
Person
Player
Guardian
PlayerGuardian
Staff
StaffTeam

## Academy
Sport
AgeGroup
Season
School
Team

## Enrollment
SchoolEnrollment
TeamMembership

## Talent
Tryout
TryoutApplication
Screening
EvaluationTemplate
EvaluationCriterion
Evaluation
EvaluationScore

## Journey
PlayerJourneyEvent

## Training
TrainingSession
TrainingPlan
TrainingExercise
Attendance

## Competition
Match
MatchLineup
PlayerMatchStat

## Performance
PerformanceRecord

## Communication
Notification
Announcement

## Documents
Document

## Reporting
Dashboards
Reports

## Audit
AuditLog

---

# 4. ساختار آکادمی

یک Sport می‌تواند چند School و چند Team داشته باشد.

مثلاً:

Sport:
Football

Age Groups:
- نونهالان
- نوجوانان
- جوانان
- امید

School:
Football School

Team:
Football U12
Football U14
Football U16
Football U18
Football U21

این ساختار باید برای رشته‌های دیگر نیز قابل استفاده باشد.

---

# 5. مسیر بازیکن

بازیکن می‌تواند از مسیرهای زیر وارد سیستم شود:

### مسیر A
School → Tryout → Accepted → Main Team

### مسیر B
Tryout مستقیم → Accepted → Main Team

### مسیر C
School → Manager Decision → Main Team

### نکته مهم
قبول شدن بازیکن در تیم اصلی به‌صورت خودکار School Enrollment را حذف نکند.

مدیر باید بتواند وضعیت School Enrollment را تغییر دهد.

---

# 6. نقش‌ها

## Admin
کنترل کامل سیستم.

## Academy Manager
مدیریت عملیاتی آکادمی.

## Staff / Coaching Staff
فقط تیم‌های Assign‌شده.

## Main Team Player
دسترسی به اطلاعات شخصی و تیم.

## School Player
دسترسی محدودتر.

## Parent
دسترسی فقط به فرزند/فرزندان خودش.

---

# 7. Authentication

Mobile + OTP

Endpoints:

POST `/api/v1/auth/otp/send`

POST `/api/v1/auth/otp/verify`

GET `/api/v1/me`

OTP:
- Expiration
- One-time use
- Rate limit
- Abuse prevention
- عدم Log

---

# 8. RBAC + Scope

Authorization باید از Backend enforce شود.

مثلاً:

Coach A فقط Team A را می‌بیند.

اگر Coach A URL مربوط به Team B را دستی وارد کرد:
Backend باید Request را Reject کند.

Parent فقط Childهای خودش را می‌بیند.

User نمی‌تواند با تغییر ID در URL اطلاعات شخص دیگر را دریافت کند.

---

# 9. Business Constraints

### Person
nationalCode unique

### Player
playerCode unique

### School Enrollment
unique:
`playerId + schoolId + seasonId`

### Team Membership
unique:
`playerId + teamId + seasonId`

### Tryout Application
unique:
`tryoutId + playerId`

### Attendance
unique:
`trainingSessionId + playerId`

### Match Lineup
unique:
`matchId + playerId`

### Match Stats
unique:
`matchId + playerId`

### Evaluation Score
unique:
`evaluationId + criterionId`

---

# 10. Tryout Engine

Public flow:

1. Tryout List
2. Tryout Detail
3. Register
4. OTP
5. Personal Info
6. Sport Info
7. Guardian
8. Documents
9. Review
10. Submit
11. Application ID
12. Status

Admin:

Screening → Evaluation → Decision

Metrics:

- Active Tryouts
- Applications
- Pending Screening
- Evaluations
- Accepted

اگر National Code متعلق به Player موجود بود:
همان Player را Reuse کن.

Duplicate Player نساز.

---

# 11. Tryout Acceptance Transaction

Acceptance باید Transaction باشد:

Application = ACCEPTED

↓

Create/Activate TeamMembership

↓

Create PlayerJourneyEvent

↓

Create Notification

اگر هر مرحله Fail شد:
Transaction Rollback شود.

---

# 12. Evaluation Engine

Evaluation Template قابل تنظیم.

Default criteria:

Technical
Physical
Mental
Overall

ساختار باید برای آینده قابل توسعه باشد.

---

# 13. Player Journey

Timeline:

Registered
↓
School Joined
↓
Tryout Registered
↓
Screening
↓
Evaluation
↓
Tryout Accepted
↓
Team Joined
↓
Promoted / Transferred

این Timeline باید در Player Profile نمایش داده شود.

---

# 14. Training

Training Session شامل:

- Team
- Date
- Time
- Location
- Type
- Plan
- Exercises
- Players
- Attendance
- Notes
- Evaluation

Types:

Technical
Physical
Tactical
Recovery
Mixed
Other

---

# 15. Attendance

Coach بتواند:

Mark All Present

و سپس:

Present
Late
Absent
Excused

را اصلاح کند.

---

# 16. Matches

Match شامل:

- Opponent
- Date
- Venue
- Home/Away/Neutral
- Status
- Result
- Lineup
- Player Stats
- Notes

Status:

Scheduled
Live
Completed
Postponed
Cancelled

---

# 17. Performance

برای بازیکن:

- Performance Records
- Charts
- Trend
- History

نمایش اطلاعات باید ساده و قابل فهم باشد.

---

# 18. Parent Panel

Parent باید بتواند:

- Children
- Training
- Attendance
- Matches
- Performance
- Notifications
- Profile

را ببیند.

Parent نباید بتواند اطلاعات بازیکن دیگر را مشاهده کند.

---

# 19. Dashboard

## Academy Manager

KPI:

- Total Players
- School Players
- Main Team Players
- Active Tryouts
- Applications
- Attendance
- Teams
- Sports

Charts:

- Player Growth
- Sport Distribution
- Talent Funnel
- Attendance Trend
- Alerts

## Admin

- System Overview
- Academy Overview
- Counts
- Growth
- Sport Distribution
- Talent Funnel

---

# 20. UI/UX

Style:
Enterprise + Sports Technology

Visual:
- Sepahan Yellow/Gold
- White/Off-white
- Charcoal/Near Black

Font:
Vazirmatn

RTL از ابتدا.

Admin/Manager:
Desktop First

Staff/Player/Parent:
Mobile First

Breakpoints:

<768 Mobile

768–1024 Tablet

1024–1440 Desktop

>1440 Large

MVP:
Light Theme

اما Design Tokens برای Dark Mode آماده باشند.

---

# 21. Routes

## Public

`/`
`/sports`
`/sports/[sport]`
`/schools`
`/schools/[school]`
`/teams`
`/teams/[team]`
`/tryouts`
`/tryouts/[tryout]`
`/news`

## Auth

`/login`
`/verify`

## Dashboard

`/dashboard`
`/dashboard/admin`
`/dashboard/academy-manager`
`/dashboard/staff`
`/dashboard/player`
`/dashboard/parent`

---

# 22. Player Profile

Tabs:

Overview
Profile
School
Teams
Training
Attendance
Performance
Matches
Evaluations
Tryouts
Journey
Documents

---

# 23. API

Version:
`/api/v1/`

Response:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "..."
  }
}
```

Pagination:

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5
}
```

---

# 24. Core API

Auth:
- POST `/api/v1/auth/otp/send`
- POST `/api/v1/auth/otp/verify`

Players:
- GET `/api/v1/players`
- GET `/api/v1/players/:id`
- POST `/api/v1/players`
- PATCH `/api/v1/players/:id`
- DELETE `/api/v1/players/:id`

Me:
- GET `/api/v1/me`
- GET `/api/v1/me/team`
- GET `/api/v1/me/training`
- GET `/api/v1/me/attendance`
- GET `/api/v1/me/matches`
- GET `/api/v1/me/performance`
- GET `/api/v1/me/evaluations`
- GET `/api/v1/me/journey`
- GET `/api/v1/me/documents`

Parent:
- GET `/api/v1/me/children`
- GET `/api/v1/me/children/:playerId`

Academy:
Sports
Age Groups
Seasons
Schools
Teams

Tryouts:
CRUD
Application
Screening
Decision

Training:
CRUD
Plan

Attendance:
CRUD
Mark All Present

Matches:
CRUD
Lineup
Stats

Performance:
GET/POST/PATCH/DELETE

Notifications:
GET
Read
Read All

Dashboard:
GET `/api/v1/dashboard/academy`

---

# 25. Components

Domain:

PlayerCard
PlayerJourney
TeamCard
TrainingCard
TryoutCard
EvaluationCard
AttendanceTable
PerformanceChart
TalentFunnel
StatCard

Base:

Button
Input
Select
DatePicker
Modal
Drawer
Card
Badge
Avatar
Tabs
DataTable
Pagination
Dropdown
Tooltip
Toast
Alert
Dialog
Sheet
Command
Breadcrumb
Progress
Chart
Calendar

---

# 26. Search

Global Search:

Players
Teams
Schools

Filters and Pagination preferably via URL State.

---

# 27. Database

Prisma Schema باید:
- normalized باشد
- relationها دقیق باشند
- indexes مناسب داشته باشد
- unique constraints داشته باشد
- createdAt/updatedAt استاندارد داشته باشد
- historical data را حفظ کند

Migration:

Development:
`npx prisma migrate dev --name init`

Generate:
`npx prisma generate`

Production:
`npx prisma migrate deploy`

---

# 28. Storage

Abstraction:

`lib/storage/storage.ts`

Providers:

`lib/storage/providers/local.ts`

`lib/storage/providers/s3.ts`

MVP می‌تواند Local باشد.

---

# 29. Security

پیاده‌سازی:

- Authentication
- RBAC
- Scope Authorization
- OTP Rate Limiting
- Validation
- Upload Validation
- PII Protection
- Secure Headers
- Secret Management
- Audit Logs
- DB Security
- Backups

---

# 30. Audit

Audit برای عملیات حساس:

- Role changes
- Player status changes
- Team membership
- Tryout decisions
- Evaluation
- Important profile changes
- Document operations
- Security events

---

# 31. Testing

Unit:
Business Rules

Integration:
API + DB

E2E:
Critical User Flows

حداقل:

1. OTP Login
2. RBAC
3. Scope Authorization
4. Player Creation
5. School Enrollment
6. Tryout Registration
7. Tryout Acceptance
8. Training Attendance
9. Match Lineup
10. Parent Child Access

---

# 32. Seed

Seed data:

Roles
Permissions
Sports
Age Groups
Season
Football School
Teams
Admin
Manager
Coach
Sample Players
Guardians
Staff
Training
Matches
Tryouts

اطلاعات واقعی ممنوع.

---

# 33. Responsive UX

Admin:
Dense + Powerful

Manager:
Decision-oriented

Coach:
Fast Operations

Player:
Simple

Parent:
Very Simple

Loading:
Skeleton

Empty:
Meaningful Empty State

Error:
Human-readable

Feedback:
Toast / Alert

---

# 34. Performance

- Server Components default
- Dynamic import where useful
- Pagination
- Indexed queries
- Avoid N+1
- Select only needed fields
- Cache carefully
- URL filters
- Lazy load heavy charts
- Optimize images
- Avoid unnecessary client state

---

# 35. Accessibility

- Keyboard navigation
- Semantic HTML
- Labels
- Focus states
- Color contrast
- Screen-reader friendly
- Accessible Dialogs
- Accessible Tables
- RTL correctness

---

# 36. Development Roadmap

Phase 0 — Foundation

Phase 1 — Design System

Phase 2 — Authentication

Phase 3 — RBAC

Phase 4 — Academy Core

Phase 5 — Players / Guardians / Staff

Phase 6 — Enrollment

Phase 7 — Player Journey

Phase 8 — Training

Phase 9 — Attendance

Phase 10 — Tryouts

Phase 11 — Evaluation Engine

Phase 12 — Talent Pipeline

Phase 13 — Matches

Phase 14 — Performance

Phase 15 — Notifications

Phase 16 — Dashboards

Phase 17 — Reports

Phase 18 — Documents

Phase 19 — Audit & Security

Phase 20 — Performance Optimization

Phase 21 — E2E Testing

Phase 22 — Production Deployment

---

# 37. Development Loop

برای هر Phase:

1. Understand
2. Inspect
3. Plan
4. Implement
5. Test
6. Review
7. Fix
8. Document
9. Git Commit
10. STOP

بعد از هر Phase این موارد الزامی است:

- Typecheck
- Lint
- Unit Tests
- Integration Tests در صورت مرتبط بودن
- E2E در صورت مرتبط بودن
- Build
- Git Diff Review
- Architecture Review
- Security Review
- Documentation Update

سپس گزارش بده و متوقف شو.

---

# 38. Definition of Done

Feature فقط زمانی Done است که:

- UI
- Validation
- Authorization
- Scope
- Service
- Repository
- API
- Database
- Tests
- Audit
- Loading
- Empty
- Error
- Responsive
- Accessibility
- Documentation

در صورت مرتبط بودن کامل شده باشد.

---

# 39. Git

Branches:

main
develop
feature/*
fix/*
refactor/*

Conventional Commit:

`feat:`
`fix:`
`refactor:`
`test:`
`docs:`
`chore:`

Commit Message باید معنی‌دار باشد.

---

# 40. Documentation

این فایل‌ها را ایجاد/به‌روز کن:

`docs/PRODUCT_SPEC.md`

`docs/ARCHITECTURE.md`

`docs/DATABASE.md`

`docs/API.md`

`docs/PERMISSIONS.md`

`docs/UI_UX.md`

`docs/BUSINESS_RULES.md`

`docs/IMPLEMENTATION_PLAN.md`

`docs/PROJECT_RULES.md`

`docs/SECURITY.md`

---

# 41. First Action

وقتی Prompt را اجرا کردی:

**کدنویسی نکن.**

ابتدا Repository را کامل بررسی کن.

سپس:

### گزارش 1
Current State

### گزارش 2
Architecture

### گزارش 3
Database

### گزارش 4
API

### گزارش 5
UI

### گزارش 6
Security

### گزارش 7
Missing Items

### گزارش 8
Technical Debt

### گزارش 9
Proposed Phase 0

بعد:

**STOP**

و منتظر تأیید کاربر بمان.

---

# 42. اگر ابهامی وجود داشت

اگر تصمیمی در Spec مشخص نیست:

1. Architecture موجود را بررسی کن.
2. Business Rule مرتبط را بررسی کن.
3. کم‌ریسک‌ترین راه را پیشنهاد بده.
4. اگر تصمیم معماری است، Approval بگیر.
5. از حدس‌زدن رفتار حساس خودداری کن.

---

# 43. اصل طلایی پروژه

این پروژه قرار نیست فقط یک Demo یا CRUD ساده باشد.

باید از ابتدا طوری طراحی شود که بتواند در آینده:

- چند رشته ورزشی
- چند مدرسه
- چند تیم
- هزاران بازیکن
- والدین متعدد
- کادر فنی متعدد
- استعدادیابی گسترده
- گزارش‌های مدیریتی
- اپلیکیشن موبایل
- پرداخت
- پیامک
- Push Notification
- Storage ابری
- Integration با سیستم‌های باشگاه

را پشتیبانی کند.

اما در MVP فقط قابلیت‌های تعریف‌شده را پیاده‌سازی کن.

از Overengineering خودداری کن.

---

# 44. Final Command

اکنون:

**Repository را Inspect کن.**

**Documentation را بخوان.**

**Architecture فعلی را تحلیل کن.**

**هیچ کدی ننویس.**

**گزارش وضعیت را ارائه بده.**

**Phase 0 را پیشنهاد بده.**

**سپس متوقف شو و منتظر تأیید من بمان.**
