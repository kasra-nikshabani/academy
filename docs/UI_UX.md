# UI_UX — SEPahan Academy OS

## 1. زبان بصری

Enterprise + Sports Technology. جدی، متراکم در پنل مدیریت، ساده و سریع در موبایل.

| نقش | جهت‌گیری |
|---|---|
| Palette | طلایی سپاهان (Accent) · سفید/شکسته (Surface) · ذغالی/نزدیک‌مشکی (Text) |
| Font | Vazirmatn Variable — Self-hosted |
| جهت | RTL از اولین Commit |
| Theme | MVP فقط Light؛ توکن‌های Dark از همین حالا کامل‌اند |

**طلایی، Accent است نه رنگ دکمه.** دکمه اصلی ذغالی است. دلیل: متن روی زرد طلایی به‌سختی به Contrast قابل‌قبول می‌رسد و استفاده گسترده از آن، رابط مدیریتی را خسته‌کننده می‌کند. طلایی در Focus Ring، حالت فعال منو، تأکید KPI و هویت برند حضور دارد.

## 2. توکن‌ها

همه در `app/globals.css`. هیچ رنگی نباید مستقیم در Component نوشته شود.

| گروه | توکن‌ها |
|---|---|
| Surface | `background` `card` `popover` `muted` `secondary` |
| Text | `foreground` و جفت‌های `*-foreground` |
| Brand | `brand` `brand-foreground` `brand-muted` |
| Status | `success` `warning` `info` `destructive` |
| Structure | `border` `input` `ring` `radius` |
| Sidebar | مجموعه `sidebar-*` |
| Chart | `chart-1` … `chart-5` |

هر توکن در `:root` (Light) و `.dark` تعریف شده است.

> **باز:** پالت نهایی نمودارها هنوز Placeholder است. رنگ‌های دسته‌ای/ترتیبی واقعی هنگام ساخت نمودارها (Phase 14/16) طراحی می‌شوند، نه اینجا با حدس.

## 3. RTL

- `<html lang="fa" dir="rtl">` در `app/layout.tsx`
- shadcn/ui با `rtl: true` مقداردهی شده است
- در Styling از Logical Property ها استفاده می‌شود (`ms-*`/`me-*`, `start`/`end`)، نه `left`/`right`
- تست E2E جهت و فونت را بررسی می‌کند: `e2e/smoke.spec.ts`

## 4. تایپوگرافی

Vazirmatn Variable با زیرمجموعه عربی/فارسی، به‌صورت Self-hosted از `@fontsource-variable/vazirmatn`.

Google Fonts عمداً استفاده نشد: اتکای Build و Runtime به یک دامنه خارجی برای کاربران داخل ایران ریسک دارد.

اعداد در جدول‌ها `tabular-nums` هستند تا ستون‌های عددی هم‌تراز بمانند.

## 5. Breakpoint ها

| بازه | دستگاه |
|---|---|
| `<768` | Mobile |
| `768–1024` | Tablet |
| `1024–1440` | Desktop |
| `>1440` | Large |

| مخاطب | رویکرد |
|---|---|
| Admin / Academy Manager | Desktop-first، جدول متراکم، فیلتر پیشرفته |
| Staff | عملیات روزانه سریع |
| Player | ساده، موبایل‌محور |
| Parent | ساده‌تر از همه |

## 6. حالت‌های اجباری هر صفحه

| حالت | الزام |
|---|---|
| Loading | Skeleton هم‌شکل با محتوای نهایی |
| Empty | پیام معنادار + اقدام پیشنهادی، نه فقط «داده‌ای نیست» |
| Error | پیام قابل‌فهم فارسی؛ جزئیات فنی فقط در لاگ |
| Feedback | Toast برای عملیات موفق، Alert برای هشدار پایدار |

## 7. دسترس‌پذیری

Keyboard Navigation · HTML معنایی · Label برای هر ورودی · Focus State مشخص · Contrast کافی · Dialog و Table قابل استفاده با Screen Reader · صحت RTL

## 8. Component ها

Base (Phase 1): Button, Input, Select, DatePicker, Modal, Drawer, Card, Badge, Avatar, Tabs, DataTable, Pagination, Dropdown, Tooltip, Toast, Alert, Dialog, Sheet, Command, Breadcrumb, Progress, Chart, Calendar

Domain (فازهای مربوطه): PlayerCard, PlayerJourney, TeamCard, TrainingCard, TryoutCard, EvaluationCard, AttendanceTable, PerformanceChart, TalentFunnel, StatCard

DatePicker و Calendar باید تقویم جلالی را پوشش دهند؛ ذخیره‌سازی همچنان UTC است.
