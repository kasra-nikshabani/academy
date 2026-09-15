# CLAUDE.md — SEPahan Academy OS

## 1. مأموریت پروژه
تو به‌عنوان Senior Full-Stack Engineer و Software Architect مسئول توسعه **SEPahan Academy OS** هستی؛ یک پلتفرم Production-Grade برای مدیریت آکادمی باشگاه فولاد مبارکه سپاهان و تیم‌های پایه رشته‌های مختلف.

هدف: ساخت یک سیستم واقعی، مقیاس‌پذیر، امن، RTL، چندرشته‌ای و قابل توسعه که مدیریت مدارس ورزشی، بازیکنان، والدین، تیم‌ها، کادر، استعدادیابی، تمرین، حضور و غیاب، مسابقات، ارزیابی و عملکرد را پوشش دهد.

## 2. قوانین غیرقابل مذاکره
- قبل از هر تغییر، Repository و مستندات `docs/` را بررسی کن.
- ابتدا Understand → Inspect → Plan و سپس Implement.
- بدون نیاز واقعی معماری را تغییر نده.
- Microservice ایجاد نکن؛ معماری پروژه Modular Monolith است.
- Business Logic در UI، Route Handler یا Repository قرار نده.
- از تکرار Model، API، Component، Utility و Abstraction جلوگیری کن.
- Authorization فقط در UI کافی نیست؛ Backend باید همیشه Permission و Scope را enforce کند.
- اطلاعات حساس، OTP، Token و PII را Log نکن.
- Secretها داخل Repository قرار نگیرند.
- TypeScript strict باشد و `any` غیرضروری ممنوع است.
- Dependency جدید فقط با دلیل فنی مشخص اضافه شود.
- رکوردهای تاریخی را Hard Delete نکن؛ تا حد امکان Status/Soft Delete استفاده شود.
- عملیات چندجدولی حساس باید Transactional باشند.
- بعد از هر Phase، تست‌ها و Build را اجرا کن و گزارش بده.
- پس از پایان هر Phase متوقف شو و برای Phase بعدی منتظر تأیید کاربر بمان.

## 3. Stack
- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma
- Zod
- Tailwind CSS
- shadcn/ui
- Recharts
- React Hook Form
- Server State First
- Zustand فقط در صورت نیاز واقعی
- Docker
- Nginx
- VPS
- S3-compatible storage در آینده
- Redis/BullMQ در صورت نیاز آینده

Backend نیز در همین Next.js Modular Monolith پیاده‌سازی می‌شود؛ Java/Spring در این پروژه استفاده نشود.

## 4. معماری
ساختار منطقی:

- Presentation
- API
- Application/Service
- Repository/Data Access
- Prisma/Database

Flow:
`Request → Validation → Authorization → Service → Repository → Prisma → Response`

Route Handler باید Thin باشد.

Server Components پیش‌فرض هستند. Client Components فقط برای Interactivity لازم.

## 5. ساختار پیشنهادی
```text
app/
  (public)/
  (auth)/
  dashboard/
    admin/
    academy-manager/
    staff/
    player/
    parent/

components/
  ui/
  layout/
  navigation/
  charts/
  players/
  teams/
  schools/
  training/
  tryouts/
  evaluations/
  matches/
  notifications/

lib/
  auth/
  permissions/
  validation/
  services/
  repositories/
  storage/
  errors/
  logger/
  utils/

prisma/
  schema.prisma
  seed.ts

docs/
  PRODUCT_SPEC.md
  ARCHITECTURE.md
  DATABASE.md
  API.md
  PERMISSIONS.md
  UI_UX.md
  BUSINESS_RULES.md
  IMPLEMENTATION_PLAN.md
  PROJECT_RULES.md
  SECURITY.md

CLAUDE.md
MASTER_PROMPT.md
```

## 6. نقش‌ها
- Admin
- Academy Manager
- Staff / Coaching Staff
- Main Team Player
- School Player
- Parent

Staff فقط تیم‌های Assign‌شده را می‌بیند و مدیریت می‌کند.

## 7. Identity
ورود:
`Mobile Number + OTP`

API:
- `POST /api/v1/auth/otp/send`
- `POST /api/v1/auth/otp/verify`
- `GET /api/v1/me`

OTP:
- Rate Limit
- Expiration
- One-time use
- عدم Log کردن OTP
- جلوگیری از Abuse

## 8. Domain Modules
### Identity
User, Role, Permission, UserRole, RolePermission, OtpCode

### People
Person, Player, Guardian, PlayerGuardian, Staff, StaffTeam

### Academy
Sport, AgeGroup, Season, School, Team

### Enrollment
SchoolEnrollment, TeamMembership

### Talent
Tryout, TryoutApplication, Screening, EvaluationTemplate, EvaluationCriterion, Evaluation, EvaluationScore

### Journey
PlayerJourneyEvent

### Training
TrainingSession, TrainingPlan, TrainingExercise, Attendance

### Competition
Match, MatchLineup, PlayerMatchStat

### Performance
PerformanceRecord

### Communication
Notification, Announcement

### Documents
Document

### Reporting
Dashboard/Reports

### Audit
AuditLog

## 9. مدل‌های مهم و Constraints
- `Person.nationalCode` unique
- `Player.playerCode` unique
- SchoolEnrollment unique: `playerId + schoolId + seasonId`
- TeamMembership unique: `playerId + teamId + seasonId`
- TryoutApplication unique: `tryoutId + playerId`
- Attendance unique: `trainingSessionId + playerId`
- MatchLineup unique: `matchId + playerId`
- PlayerMatchStat unique: `matchId + playerId`
- EvaluationScore unique: `evaluationId + criterionId`

## 10. Enums
UserStatus:
ACTIVE, INACTIVE, BLOCKED

Gender:
MALE, FEMALE, OTHER

PlayerStatus:
ACTIVE, INACTIVE, INJURED, TRANSFERRED, RETIRED

StaffStatus:
ACTIVE, INACTIVE

EnrollmentStatus:
PENDING, ACTIVE, TRANSFERRED, COMPLETED, CANCELLED

MembershipStatus:
ACTIVE, INACTIVE, RELEASED

SeasonStatus:
UPCOMING, ACTIVE, COMPLETED, ARCHIVED

TryoutStatus:
DRAFT, OPEN, CLOSED, CANCELLED, COMPLETED

ApplicationStatus:
SUBMITTED, SCREENING, EVALUATION, ACCEPTED, REJECTED, WAITLIST, CANCELLED

ScreeningStatus:
PENDING, APPROVED, REJECTED

AttendanceStatus:
PRESENT, LATE, ABSENT, EXCUSED

TrainingStatus:
DRAFT, SCHEDULED, COMPLETED, CANCELLED

TrainingType:
TECHNICAL, PHYSICAL, TACTICAL, RECOVERY, MIXED, OTHER

MatchStatus:
SCHEDULED, LIVE, COMPLETED, POSTPONED, CANCELLED

HomeAway:
HOME, AWAY, NEUTRAL

NotificationType:
INFO, SUCCESS, WARNING, ALERT, TRAINING, MATCH, ATTENDANCE, EVALUATION, TRYOUT, SYSTEM

DocumentType:
ID_DOCUMENT, BIRTH_CERTIFICATE, CONTRACT, MEDICAL, PARENT_CONSENT, PHOTO, OTHER

JourneyEventType:
REGISTERED, SCHOOL_JOINED, TRYOUT_REGISTERED, TRYOUT_ACCEPTED, TRYOUT_REJECTED, EVALUATION, TEAM_JOINED, TEAM_LEFT, PROMOTED, TRANSFERRED, ACHIEVEMENT, OTHER

## 11. Business Rules
1. اگر فردی برای Tryout ثبت‌نام کرد و Player موجود دارد، همان Player استفاده شود؛ Duplicate نساز.
2. قبول شدن School Player در Tryout، School Enrollment را حذف نکند.
3. انتقال School Player به Main Team فقط با تصمیم/Action معتبر Manager انجام شود.
4. Age Group هنگام Tryout/Enrollment اعتبارسنجی شود؛ Admin می‌تواند Exception بدهد.
5. Staff فقط تیم‌های Assigned را مدیریت کند.
6. رکوردهای تاریخی حذف نشوند.
7. پذیرش Tryout باید Transaction باشد:
   `Application ACCEPTED → TeamMembership → PlayerJourneyEvent → Notification`
8. وضعیت‌های حساس و تغییرات مهم Audit شوند.

## 12. Player Journey
مسیر قابل مشاهده:
`Registered → School Joined → Tryout → Screening → Evaluation → Accepted → Main Team → Promotion/Transfer`

در UI از `PlayerJourney` استفاده کن.

## 13. Tryout
Public:
- Tryout Landing
- Details
- Register
- OTP
- Personal Information
- Sport Information
- Guardian
- Documents
- Review
- Submit
- Application ID
- Status

Admin:
- Screening
- Evaluation
- Decision
- Funnel Metrics

Metrics:
- Active Tryouts
- Applications
- Pending Screening
- Evaluations
- Accepted

## 14. Evaluation Engine
قابل تنظیم باشد.

ابعاد پیش‌فرض:
- Technical
- Physical
- Mental
- Overall

از EvaluationTemplate و EvaluationCriterion استفاده کن.

## 15. Training
قابلیت‌ها:
- Calendar
- List
- Team View
- Training Plan
- Exercises
- Players
- Attendance
- Evaluation
- Notes

Attendance:
`Mark All Present` سپس اصلاح:
Present / Late / Absent / Excused

## 16. Matches
- Upcoming
- Live
- Completed
- Match Details
- Lineup
- Player Stats
- Result
- Notes

## 17. Performance
رکوردهای عملکردی بازیکن باید قابل مشاهده در Timeline/Chart باشند.

## 18. Documents
Document abstraction داشته باش:
`lib/storage/`

فعلاً Local Provider ممکن است، اما معماری برای S3-compatible آماده باشد.

## 19. API
Prefix:
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

## 20. مسیرهای اصلی
Public:
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

Auth:
`/login`
`/verify`

Dashboard:
`/dashboard`
`/dashboard/admin`
`/dashboard/academy-manager`
`/dashboard/staff`
`/dashboard/player`
`/dashboard/parent`

## 21. پنل‌ها
### Admin
Sports, Schools, Teams, Seasons, Players, Staff, Tryouts, Evaluations, Training, Matches, Notifications, Documents, Settings

### Academy Manager
Dashboard, Players, Schools, Teams, Staff, Tryouts, Training, Matches, Talent Pipeline, Reports, Notifications

### Staff
Dashboard, My Team, Players, Training, Attendance, Matches, Evaluations, Notifications

### Player
Home, My Team, Training, Attendance, Matches, Performance, Evaluations, Tryouts, Documents, Notifications, Profile

### Parent
Home, My Children, Training, Attendance, Matches, Performance, Notifications, Profile

## 22. UI/UX
Design:
Enterprise + Sports Technology

Palette:
- Sepahan Yellow/Gold Accent
- White/Off-white
- Charcoal/Near Black

Font:
Vazirmatn

RTL از روز اول.

Admin/Manager:
Desktop-first

Player/Parent/Staff:
Mobile-first

Breakpoints:
- Mobile <768
- Tablet 768–1024
- Desktop 1024–1440
- Large >1440

Dark Mode:
Tokens آماده باشد؛ MVP می‌تواند Light باشد.

## 23. UX Philosophy
Admin:
Dense Tables + Filters + Advanced Controls

Manager:
KPI + Charts + Decision Making

Coach:
Fast Daily Operations

Player:
Simple Mobile UX

Parent:
Even Simpler UX

## 24. Components
Domain Components:
- PlayerCard
- PlayerJourney
- TeamCard
- TrainingCard
- TryoutCard
- EvaluationCard
- AttendanceTable
- PerformanceChart
- TalentFunnel
- StatCard

Base:
Button, Input, Select, DatePicker, Modal, Drawer, Card, Badge, Avatar, Tabs, Table/DataTable, Pagination, Dropdown, Tooltip, Toast, Alert, Dialog, Sheet, Command, Breadcrumb, Progress, Chart, Calendar

## 25. Search
Global Search برای:
- Players
- Teams
- Schools

Filters/Pagination ترجیحاً در URL State باشند.

## 26. Security
- Authentication
- RBAC
- Scope Authorization
- OTP Rate Limit
- Input Validation
- Upload Validation
- PII Protection
- Secure Headers
- Secret Management
- Audit Log
- Database Security
- Backups

## 27. Logging
Central Logger.

هرگز:
- OTP
- Access Token
- Password/Secret
- National Code غیرضروری
- Sensitive PII

را Log نکن.

## 28. Testing
سه سطح:
- Unit
- Integration
- E2E

حداقل سناریوهای E2E:
- OTP Login
- Role Access
- Staff Scope
- Player creation
- School enrollment
- Tryout application
- Tryout acceptance transaction
- Training attendance
- Match lineup
- Parent child access

## 29. Seed
Seed شامل:
- Roles
- Permissions
- Sports
- Age Groups
- Active Season
- Football School
- Teams
- Admin
- Manager
- Coach
- Sample Players
- Guardians
- Staff
- Training
- Matches
- Tryouts

اطلاعات واقعی بازیکنان هرگز داخل Git نباشد.

## 30. Git
Branches:
- main
- develop
- feature/*
- fix/*
- refactor/*

Conventional Commits:
`feat:`
`fix:`
`refactor:`
`test:`
`docs:`
`chore:`

## 31. Roadmap
Phase 0 Foundation
Phase 1 Design System
Phase 2 Authentication
Phase 3 RBAC
Phase 4 Academy Core
Phase 5 Players/Guardians/Staff
Phase 6 Enrollment
Phase 7 Player Journey
Phase 8 Training
Phase 9 Attendance
Phase 10 Tryouts
Phase 11 Evaluation Engine
Phase 12 Talent Pipeline
Phase 13 Matches
Phase 14 Performance
Phase 15 Notifications
Phase 16 Dashboards
Phase 17 Reports
Phase 18 Documents
Phase 19 Audit & Security
Phase 20 Performance Optimization
Phase 21 E2E Testing
Phase 22 Production Deployment

## 32. Definition of Done
یک Feature فقط زمانی Done است که:
- UI کامل
- Validation
- Authorization
- Scope
- Service
- Repository
- API
- Database
- Tests
- Audit در صورت نیاز
- Loading State
- Empty State
- Error State
- Responsive UI
- Accessibility
- Documentation

کامل باشد.

## 33. Development Loop
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

## 34. اولین اقدام
وقتی پروژه را باز کردی:
1. Repository را Inspect کن.
2. `CLAUDE.md` را بخوان.
3. تمام فایل‌های `docs/` موجود را بخوان.
4. `package.json` را بررسی کن.
5. ساختار `app/`, `components/`, `lib/`, `prisma/` را بررسی کن.
6. وضعیت Git را بررسی کن.
7. Architecture فعلی را با Spec مقایسه کن.
8. هیچ Feature جدیدی را هنوز پیاده‌سازی نکن.
9. گزارش بده:
   - وضعیت فعلی
   - Architecture فعلی
   - چه چیزهایی موجود است
   - چه چیزهایی ناقص است
   - ریسک‌ها
   - پیشنهاد Phase 0
10. سپس STOP کن و منتظر تأیید کاربر بمان.

## 35. اصل نهایی
کیفیت، امنیت، Maintainability و Consistency از سرعت مهم‌تر است.
اگر چیزی مبهم است، حدس نزن؛ کم‌ریسک‌ترین راه سازگار با معماری را پیشنهاد بده و قبل از تغییر معماری تأیید بگیر.
