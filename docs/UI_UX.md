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

> **`CardTitle` یک Heading است، نه `div`.** shadcn آن را `div` می‌سازد؛ چون کارت یک بخش از صفحه را عنوان می‌دهد، کاربری که با Heading ها پیمایش می‌کند در آن حالت از روی همه کارت‌های صفحه می‌پرد. عنوان صفحه `h1` است (در `PageHeader`) و کارت‌ها یک سطح پایین‌تر، `h2`.

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
| `DataTable` | `components/ui/data-table.tsx` |
| `AppShell` | `components/layout/app-shell.tsx` |
| `SidebarNav` | `components/navigation/sidebar-nav.tsx` |
| `PlayerJourney` | `components/players/player-journey.tsx` |
| `TrainingCard` | `components/training/training-card.tsx` |
| `TrainingWeek` | `components/training/training-week.tsx` |
| `AttendanceSheet` | `components/training/attendance-sheet.tsx` |
| `AttendanceSummary` | `components/training/attendance-summary.tsx` |
| `TryoutRegistration` | `components/tryouts/tryout-registration.tsx` |
| `ApplicationStatusLookup` | `components/tryouts/application-status-lookup.tsx` |
| `ApplicationActions` | `components/tryouts/application-actions.tsx` |
| `PageHeader` | `components/layout/page-header.tsx` |

### ⏳ عمداً به تعویق افتاده

| کامپوننت | فاز | دلیل |
|---|---|---|
| `Chart` (+ Recharts) | ۱۴ | تا وقتی نموداری وجود ندارد، افزودن Recharts یک وابستگی بدون مصرف است |
| ~~`DataTable`~~ | ✅ ۴ | ساخته شد وقتی اولین فهرست واقعی (تیم‌ها) وجود داشت |

### Domain Component ها

PlayerCard · ~~PlayerJourney~~ (✅ ۷) · TeamCard · ~~TrainingCard~~ (✅ ۸) · TryoutCard · EvaluationCard · ~~AttendanceTable~~ (✅ ۹ — به‌صورت `AttendanceSheet`) · PerformanceChart · TalentFunnel · StatCard — هرکدام در فاز دامنه خودش.

### چرا دفتر حضور جدول نشد

`AttendanceTable` در فهرست بالا یک جدول را تداعی می‌کند. اما این صفحه روی گوشی و کنار زمین باز می‌شود؛ جدولی با چهار ستون وضعیت در ۳۷۵ پیکسل یا افقی اسکرول می‌خورد یا ستون‌هایش به چند کاراکتر بریده می‌شوند.

به‌جایش هر بازیکن یک ردیف است با یک کنترل چهارگزینه‌ای در همان خط، و فیلد توضیح فقط روی ردیف‌هایی باز می‌شود که استثنا هستند — بازیکن حاضر چیزی برای توضیح دادن ندارد.

کنترل روی `RadioGroup` رادیکس ساخته شده تا پیمایش با کلید جهت و `aria-checked` درست باشد، اما ظاهرش یک نوار چهاربخشی است نه چهار دایره.

### ثبت‌نام استعدادیابی — چرا یک صفحه و نه پنج

`PRODUCT_SPEC` §۵ جریان را به‌صورت شماره → OTP → اطلاعات فردی → ورزشی → ولی → مرور → ثبت توصیف می‌کند. این مراحل در **یک** کامپوننت و **یک** نشانی پیاده شده‌اند، نه پنج Route.

دلیل: خانواده‌ای که این فرم را روی گوشی پر می‌کند نباید بتواند با زدن دکمه Back جایش را گم کند، و هیچ‌کدام از این مراحل ارزش یک نشانی جدا را ندارند. تنها چیز ماندگاری که این جریان تولید می‌کند، کد پیگیری انتهای آن است — و آن هم در صفحه «پیگیری درخواست» دوباره قابل دسترسی است.

**بخش ولی با تاریخ تولد ظاهر می‌شود، نه با یک تیک.** فرمی که می‌پرسد «آیا زیر ۱۸ سال است؟» جوابی را دعوت می‌کند که فرم را کوتاه‌تر کند.

### دفتر تصمیم مدیریتی — ترتیب کار، ترتیب رابط

در صفحه درخواست‌ها، دکمه‌های تصمیم تا وقتی غربالگری تأیید نشده اصلاً نمایش داده نمی‌شوند. ترتیبی که باشگاه کار می‌کند، همان ترتیبی است که رابط اجازه می‌دهد.

### یک باگ کنتراست در `Button` variant=`outline`

این Variant پس‌زمینه روشن خودش را می‌گذاشت اما رنگ متن را از والدش به ارث می‌برد. روی نوار تیره (Sidebar و Header عمومی) نتیجه، متن نزدیک‌به‌سفید روی دکمه نزدیک‌به‌سفید بود — نسبت کنتراست حدود ۱٫۱، فقط با Hover خوانا (چون Hover رنگ را ست می‌کرد).

اصلاح در خود Variant انجام شد نه در صفحه: هر Variant ای که پس‌زمینه می‌گذارد باید رنگ متنش را هم بگذارد.

### چرا بدون React Hook Form

اولین فرم تعاملی پروژه است و وسوسه‌برانگیز بود که RHF همین‌جا اضافه شود. اما این فرم فهرستی از انتخاب چهارگزینه‌ای است، بدون اعتبارسنجی بین‌فیلدی و بدون فیلد اجباری. `useState` ساده‌تر و کوچک‌تر است.

RHF جایش فرم ثبت‌نام Tryout در Phase 10 است — چند مرحله، اعتبارسنجی کد ملی و موبایل، و آپلود مدرک (CLAUDE.md §۲ — وابستگی با دلیل).

### تقویم هفتگی تمرین — چرا Container Query و نه Breakpoint

`TrainingWeek` روی دسکتاپ هفت ستون و روی موبایل فهرستی از روزهاست. **همان کارت** در یکی حدود ۹۰ پیکسل عرض دارد و در دیگری تمام‌عرض است — در حالی‌که عرض Viewport در حالت اول بزرگ‌تر است. Breakpoint این دو را برعکس جواب می‌دهد.

نسخه اول کارت، بازه ساعت و برچسب وضعیت و مکان و نام برنامه را نشان می‌داد؛ در ستون هفته، بازه روی سه خط می‌شکست و Badge به «برگز» بریده می‌شد. حالا کارت پایه فقط ساعت شروع، نام تیم، نوع و وضعیت را دارد و بقیه با `@[11rem]:` وقتی ظاهر می‌شود که واقعاً جا باشد. متن کامل همیشه در `aria-label` و `title` هست.

**روزهای خالی روی موبایل حذف می‌شوند.** پنج کارت خالی تا رسیدن به دوشنبه، بدتر از ندیدن یکشنبه است. روی دسکتاپ ستونشان می‌ماند تا شکل هفته حفظ شود.

### چرا تقویم اختصاصی نوشته شد

`react-day-picker` نصب و سپس حذف شد. آن کتابخانه یک ماه **میلادی** را مدل می‌کند و برای جلالی به یک DateLib کامل سفارشی نیاز دارد — یعنی همان ریاضیات، به‌علاوه پیچیدگی Adapter. نوشتن مستقیم جدول ماه، ترتیب هفته (شنبه‌محور)، سال کبیسه و ارقام فارسی را در یک نقطه درست نگه می‌دارد و کاملاً تست‌پذیر است.
