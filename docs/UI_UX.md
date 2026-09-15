# UI_UX — SEPahan Academy OS

## 1. زبان بصری

Enterprise + Sports Technology. جدی، متراکم در پنل مدیریت، ساده و سریع در موبایل.

| نقش | جهت‌گیری |
|---|---|
| Palette | طلایی سپاهان (Accent) · سفید/شکسته (Surface) · مشکی نشان باشگاه (Text) |
| Font | Vazirmatn Variable — Self-hosted |
| جهت | RTL از اولین Commit |
| Theme | MVP فقط Light؛ توکن‌های Dark از همین حالا کامل‌اند |

### رنگ‌ها از خود نشان باشگاه گرفته شده‌اند

مقادیر مستقیماً از فایل `public/brand/sepahan-crest.png` نمونه‌برداری شده‌اند — نه تقریب:

| رنگ | HEX | OKLCH | توکن |
|---|---|---|---|
| طلایی سپاهان | `#FCCC00` | `oklch(0.862 0.176 91.5)` | `--brand` |
| طلایی پررنگ‌تر | — | `oklch(0.78 0.168 88)` | `--brand-strong` |
| مشکی نشان | `#1E1812` | `oklch(0.214 0.015 66.9)` | `--foreground` |
| سفید نشان | `#FCFCFC` | `oklch(0.991 0 90)` | `--primary-foreground` |

**مشکی نشان باشگاه گرم است (Hue ≈ ۶۷)، نه خاکستری خنثی.** همه سطوح و متن‌ها همین گرمی را دارند تا رابط شبیه نشان باشگاه دیده شود، نه شبیه یک پنل مدیریتی عمومی.

`--brand-strong` برای Focus Ring، Border و خطوط نازک استفاده می‌شود؛ طلایی اصلی در `L≈0.86` روی پس‌زمینه روشن به Contrast کافی نمی‌رسد.

**Navigation در هر دو Theme مشکی می‌ماند.** ترکیب مشکی و طلایی هویت شناخته‌شده باشگاه است؛ پوسته این هویت را حمل می‌کند و ناحیه محتوا آرام و خوانا می‌ماند.

### نشان باشگاه

| فایل | کاربرد |
|---|---|
| `public/brand/sepahan-crest.png` | نسخه اصلی ۱۲۰۰×۱۲۰۰ |
| `public/brand/sepahan-crest-512.png` | نسخه ۵۱۲ |
| `app/icon.png` · `app/apple-icon.png` | Favicon و آیکون iOS |

کامپوننت‌ها:

- `<SepahanCrest size={…} />` — فقط نشان
- `<BrandLockup size="sm|md|lg" crestOnly />` — نشان + نام، برای ورود، Header و گزارش‌های چاپی

نشان هرگز نباید در هر صفحه دوباره Crop یا تایپ‌ست شود؛ همیشه از این دو کامپوننت استفاده کنید.

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

همه توکن‌ها به‌صورت زنده در `/style-guide` قابل مشاهده‌اند.

### نکته درباره دکمه Destructive
پیش‌تنظیم `radix-nova` دکمه Destructive را به‌صورت **ملایم** (`bg-destructive/10`) ارائه می‌کند، نه قرمز توپر. این با قاعده کسب‌وکار پروژه سازگار است: تقریباً هیچ‌جا Hard Delete نداریم و عملیات «حذف» در عمل تغییر وضعیت است. اگر در آینده عملیات واقعاً برگشت‌ناپذیری اضافه شد، یک Variant پررنگ‌تر برای آن تعریف می‌شود.

## 3. RTL

- `<html lang="fa" dir="rtl">` در `app/layout.tsx`
- shadcn/ui با `rtl: true` مقداردهی شده است
- در Styling از Logical Property ها استفاده می‌شود (`ms-*`/`me-*`, `start`/`end`)، نه `left`/`right`
- تست E2E جهت و فونت را بررسی می‌کند: `e2e/smoke.spec.ts`

### قاعده Bidi — اجباری

هر مقداری که **شناسه** است و باید چپ‌به‌راست خوانده شود، باید ایزوله شود:

```tsx
<bdi dir="ltr">{player.mobile}</bdi>
```

شامل: شماره موبایل، کد ملی، کد بازیکن، ایمیل، شناسه درخواست و هر مقدار لاتین.

بدون این کار، جریان RTL ترتیب گروه‌های رقمی را جابه‌جا می‌کند — مثلاً `0912 345 6789` به‌صورت `6789 345 0912` نمایش داده می‌شود. این باگ در Phase 1 دیده و رفع شد.

عناصر `code`، `kbd`، `samp` و `pre` به‌صورت سراسری در `app/globals.css` ایزوله شده‌اند.

## 4. تاریخ جلالی

تمام تاریخ‌ها در دیتابیس **UTC** ذخیره می‌شوند و فقط در لایه نمایش به جلالی تبدیل می‌شوند (`lib/utils/date.ts`).

دو منبع به‌صورت عمدی استفاده می‌شود:

| کار | ابزار | دلیل |
|---|---|---|
| نمایش (نام ماه، روز هفته) | `Intl.DateTimeFormat` با تقویم `persian` | داخل Node و مرورگر هست، بدون وابستگی |
| محاسبه (طول ماه، ساخت جدول، تبدیل معکوس) | `jalaali-js` | پیاده‌سازی مرجع الگوریتم Borkowski |

`tests/unit/date.test.ts` این دو را در بازه ۵۰ ساله با هم مقایسه می‌کند؛ اگر روزی از هم فاصله بگیرند، Build شکست می‌خورد.

نکات:

- منطقه زمانی همه‌جا `Asia/Tehran` است (`ACADEMY_TIME_ZONE`)
- تاریخ‌های بدون ساعت (مثل تاریخ تولد) روی **ظهر تهران** لنگر می‌اندازند تا با تغییر Offset به روز قبل نلغزند
- هفته از **شنبه** شروع می‌شود
- `formatJalaliLong` رشته را دستی می‌سازد، چون ترتیب خروجی ICU در Node و Chrome یکسان نیست و این رشته، نام قابل‌دسترس هر خانه تقویم است

## 5. تایپوگرافی

Vazirmatn Variable با زیرمجموعه عربی/فارسی، به‌صورت Self-hosted از `@fontsource-variable/vazirmatn`.

Google Fonts عمداً استفاده نشد: اتکای Build و Runtime به یک دامنه خارجی برای کاربران داخل ایران ریسک دارد.

اعداد در جدول‌ها `tabular-nums` هستند تا ستون‌های عددی هم‌تراز بمانند.

## 6. Breakpoint ها

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

## 7. حالت‌های اجباری هر صفحه

| حالت | الزام |
|---|---|
| Loading | Skeleton هم‌شکل با محتوای نهایی |
| Empty | پیام معنادار + اقدام پیشنهادی، نه فقط «داده‌ای نیست» |
| Error | پیام قابل‌فهم فارسی؛ جزئیات فنی فقط در لاگ |
| Feedback | Toast برای عملیات موفق، Alert برای هشدار پایدار |

## 8. دسترس‌پذیری

Keyboard Navigation · HTML معنایی · Label برای هر ورودی · Focus State مشخص · Contrast کافی · Dialog و Table قابل استفاده با Screen Reader · صحت RTL

## 9. Component ها

### ✅ پیاده‌سازی‌شده (Phase 1)

Button · Input · Textarea · Label · Select · Checkbox · RadioGroup · Switch · Card · Badge · Avatar · Separator · Tabs · Table · Dialog · AlertDialog · Sheet · Drawer · DropdownMenu · Popover · Tooltip · Command · Breadcrumb · Progress · Alert · Skeleton · ScrollArea · Toast (Sonner) · Pagination · Form · InputGroup

اختصاصی این پروژه:

| کامپوننت | محل |
|---|---|
| `JalaliCalendar` | `components/ui/jalali-calendar.tsx` |
| `DatePicker` | `components/ui/date-picker.tsx` |
| `EmptyState` | `components/states/empty-state.tsx` |
| `ErrorState` | `components/states/error-state.tsx` |
| `TableSkeleton` / `CardGridSkeleton` / `StatCardsSkeleton` | `components/states/loading-state.tsx` |
| `PageHeader` | `components/layout/page-header.tsx` |

### ⏳ عمداً به تعویق افتاده

| کامپوننت | فاز | دلیل |
|---|---|---|
| `Chart` (+ Recharts) | ۱۴ | تا وقتی نموداری وجود ندارد، افزودن Recharts یک وابستگی بدون مصرف است |
| `DataTable` | ۵ | انتزاع جدول داده بدون یک فهرست واقعی، حدس زدن است |

### Domain Component ها

PlayerCard · PlayerJourney · TeamCard · TrainingCard · TryoutCard · EvaluationCard · AttendanceTable · PerformanceChart · TalentFunnel · StatCard — هرکدام در فاز دامنه خودش.

### چرا تقویم اختصاصی نوشته شد

`react-day-picker` نصب و سپس حذف شد. آن کتابخانه یک ماه **میلادی** را مدل می‌کند و برای جلالی به یک DateLib کامل سفارشی نیاز دارد — یعنی همان ریاضیات، به‌علاوه پیچیدگی Adapter. نوشتن مستقیم جدول ماه، ترتیب هفته (شنبه‌محور)، سال کبیسه و ارقام فارسی را در یک نقطه درست نگه می‌دارد و کاملاً تست‌پذیر است.
