# PROJECT_RULES — SEPahan Academy OS

## 1. قواعد غیرقابل مذاکره

منبع اصلی: [`../CLAUDE.md`](../CLAUDE.md) §2. خلاصه عملیاتی:

- TypeScript strict؛ `any` غیرضروری ممنوع
- Business Logic فقط در `lib/services`
- Repository فقط Data Access
- Zod برای هر ورودی خارجی
- Authorization همیشه در Backend؛ UI کافی نیست
- Secret داخل Git ممنوع
- OTP/Token/PII در Log ممنوع
- رکورد تاریخی Hard Delete نمی‌شود
- عملیات چندجدولی حساس Transactional است
- Dependency جدید فقط با دلیل فنی مکتوب
- تغییر معماری فقط با تأیید

## 2. Definition of Done

یک Feature وقتی Done است که در صورت مرتبط بودن، همه این‌ها کامل باشند:

UI · Validation · Authorization · Scope · Service · Repository · API · Database · Tests · Audit · Loading State · Empty State · Error State · Responsive · Accessibility · Documentation

## 3. حلقه توسعه هر فاز

```
Understand → Inspect → Plan → Implement → Test → Review → Fix → Document → Commit → STOP
```

پیش از پایان هر فاز، این دستور باید سبز باشد:

```bash
pnpm verify      # typecheck + lint + test + build
```

و در صورت مرتبط بودن:

```bash
pnpm test:e2e
```

سپس گزارش داده می‌شود و کار تا تأیید فاز بعدی متوقف می‌ماند.

## 4. Git

شاخه‌ها:

```
main        نسخه پایدار
develop     یکپارچه‌سازی
feature/*   قابلیت جدید
fix/*       رفع اشکال
refactor/*  بازسازی بدون تغییر رفتار
```

Conventional Commits:

```
feat:  fix:  refactor:  test:  docs:  chore:
```

پیام Commit باید بگوید چه چیزی تغییر کرده و چرا — نه صرفاً نام فایل‌ها.

## 5. سبک کد

- نام‌گذاری فایل: `kebab-case.ts`؛ Component ها `PascalCase.tsx`
- Service ها فعل‌محور: `acceptTryoutApplication()`
- Repository ها داده‌محور: `findPlayerById()`
- هر Export عمومی که رفتار غیربدیهی دارد، یک کامنت کوتاه «چرا» می‌گیرد — نه «چه»
- Prettier تنها مرجع Formatting است

## 6. تست

| سطح | ابزار | محدوده |
|---|---|---|
| Unit | Vitest | قواعد کسب‌وکار، توابع خالص، Redaction |
| Integration | Vitest | Service + Repository + دیتابیس واقعی |
| E2E | Playwright | مسیرهای بحرانی کاربر |

ده سناریوی اجباری E2E در [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) فهرست شده‌اند.

## 7. افزودن کامپوننت shadcn

```bash
pnpm dlx shadcn@4.21.0 add <component>
pnpm ui:fix
```

قدم دوم اجباری است: `shadcn add` کامپوننت را با `import { cn } from "cn"` می‌نویسد و یک Micro-package را به‌عنوان وابستگی Runtime برمی‌گرداند. `pnpm ui:fix` ایمپورت‌ها را به `@/lib/utils` برمی‌گرداند. اگر پکیج `cn` دوباره در `package.json` ظاهر شد، حذفش کنید.

## 8. وابستگی جدید

قبل از افزودن هر Package:

1. آیا با کد موجود یا کتابخانه فعلی حل می‌شود؟
2. آیا نگهداری فعال دارد؟
3. آیا حجم/سطح دسترسی آن توجیه دارد؟

دلیل انتخاب در [`ARCHITECTURE.md`](ARCHITECTURE.md) §6 ثبت می‌شود.
