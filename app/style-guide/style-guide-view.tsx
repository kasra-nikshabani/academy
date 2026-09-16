"use client";

import * as React from "react";
import { Users, Trophy, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import {
  CardGridSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/states/loading-state";
import {
  formatJalali,
  formatJalaliDateTime,
  formatJalaliLong,
  formatJalaliNumeric,
} from "@/lib/utils/date";
import {
  formatNumber,
  formatPercent,
  toPersianDigits,
} from "@/lib/utils/number";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-border pb-2 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const SURFACE_TOKENS = [
  "background",
  "card",
  "muted",
  "secondary",
  "accent",
  "border",
] as const;

const BRAND_TOKENS = ["brand", "brand-muted", "primary"] as const;
const STATUS_TOKENS = ["success", "warning", "info", "destructive"] as const;

function Swatch({ token }: { token: string }) {
  return (
    <div className="space-y-1.5">
      <div
        className="h-14 rounded-md border border-border"
        style={{ backgroundColor: `var(--${token})` }}
      />
      <code className="block text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

/**
 * A fixed reference instant rather than `new Date()`.
 *
 * The server and the client would otherwise format two different moments and
 * React would report a hydration mismatch — and a style guide is about showing
 * the *formats*, so a stable date also keeps the page diff-able between runs.
 */
const REFERENCE_DATE = new Date("2026-09-15T12:15:00Z");

export function StyleGuideView() {
  const [date, setDate] = React.useState<Date | undefined>(REFERENCE_DATE);
  const now = REFERENCE_DATE;

  return (
    <div className="space-y-10">
      <Section title="رنگ‌ها">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">برند</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {BRAND_TOKENS.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">سطوح</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {SURFACE_TOKENS.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">وضعیت</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {STATUS_TOKENS.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="تایپوگرافی">
        <div className="space-y-2">
          <p className="text-3xl font-bold">تیتر اصلی — وزیرمتن</p>
          <p className="text-xl font-semibold">تیتر فرعی</p>
          <p className="leading-8">
            متن بدنه با فونت وزیرمتن. این فونت به‌صورت Self-hosted بارگذاری
            می‌شود و زیرمجموعه فارسی/عربی را کامل پوشش می‌دهد.
          </p>
          <p className="text-sm text-muted-foreground">متن کمکی و توضیحات</p>
        </div>
      </Section>

      <Section title="اعداد و تاریخ">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "ارقام فارسی",
              value: toPersianDigits("0912 345 6789"),
              ltr: true,
            },
            { label: "عدد با جداکننده", value: formatNumber(12500) },
            { label: "درصد حضور", value: formatPercent(0.847) },
            { label: "تاریخ", value: formatJalali(now) },
            { label: "تاریخ کامل", value: formatJalaliLong(now) },
            { label: "تاریخ عددی", value: formatJalaliNumeric(now) },
            { label: "تاریخ و ساعت", value: formatJalaliDateTime(now) },
          ].map(({ label, value, ltr }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              {/* Identifiers — phone, national code, player code — stay LTR so
                  the RTL flow does not reorder their digit groups. */}
              <bdi dir={ltr ? "ltr" : "auto"} className="text-sm font-medium">
                {value}
              </bdi>
            </div>
          ))}
        </div>
      </Section>

      <Section title="دکمه‌ها">
        <div className="flex flex-wrap items-center gap-3">
          <Button>ذخیره</Button>
          <Button variant="secondary">انصراف</Button>
          <Button variant="outline">ویرایش</Button>
          <Button variant="ghost">بیشتر</Button>
          <Button variant="destructive">حذف</Button>
          <Button variant="link">راهنما</Button>
          <Button disabled>غیرفعال</Button>
          <Button size="sm">کوچک</Button>
          <Button size="lg">بزرگ</Button>
        </div>
      </Section>

      <Section title="فرم">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sg-name">نام بازیکن</Label>
            <Input id="sg-name" placeholder="مثلاً علی رضایی" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sg-mobile">شماره موبایل</Label>
            <Input
              id="sg-mobile"
              inputMode="numeric"
              placeholder="09123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sg-birth">تاریخ تولد</Label>
            <DatePicker
              id="sg-birth"
              value={date}
              onChange={setDate}
              maxDate={now}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sg-team">تیم</Label>
            <Select>
              <SelectTrigger id="sg-team">
                <SelectValue placeholder="انتخاب تیم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="u12">فوتبال زیر ۱۲ سال</SelectItem>
                <SelectItem value="u14">فوتبال زیر ۱۴ سال</SelectItem>
                <SelectItem value="u16">فوتبال زیر ۱۶ سال</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sg-note">یادداشت مربی</Label>
            <Textarea id="sg-note" rows={3} placeholder="توضیحات جلسه تمرین…" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="sg-consent" />
            <Label htmlFor="sg-consent" className="font-normal">
              رضایت‌نامه ولی دریافت شده است
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="sg-active" defaultChecked />
            <Label htmlFor="sg-active" className="font-normal">
              بازیکن فعال
            </Label>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>وضعیت حضور</Label>
            <RadioGroup defaultValue="present" className="flex flex-wrap gap-4">
              {[
                { value: "present", label: "حاضر" },
                { value: "late", label: "با تأخیر" },
                { value: "absent", label: "غایب" },
                { value: "excused", label: "غیبت موجه" },
              ].map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`sg-${option.value}`}
                  />
                  <Label htmlFor={`sg-${option.value}`} className="font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </Section>

      <Section title="نمایش داده">
        <div className="space-y-5">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">آکادمی</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">تیم‌ها</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>زیر ۱۴ سال</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>فعال</Badge>
            <Badge variant="secondary">مدرسه</Badge>
            <Badge variant="outline">در انتظار</Badge>
            <Badge variant="destructive">مصدوم</Badge>
          </div>

          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>ع‌ر</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>م‌ح</AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  راهنما
                </Button>
              </TooltipTrigger>
              <TooltipContent>توضیح کوتاه درباره این بخش</TooltipContent>
            </Tooltip>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Users, label: "کل بازیکنان", value: 248 },
              { icon: Trophy, label: "تیم‌ها", value: 12 },
              { icon: CalendarDays, label: "تمرین این هفته", value: 34 },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="size-4 text-brand" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatNumber(stat.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>میانگین حضور</span>
              <span className="font-medium">{formatPercent(0.84)}</span>
            </div>
            <Progress value={84} />
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>بازیکن</TableHead>
                <TableHead>تیم</TableHead>
                <TableHead>تاریخ تولد</TableHead>
                <TableHead>وضعیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  name: "علی رضایی",
                  team: "زیر ۱۴ سال",
                  birth: new Date("2012-04-18T09:00:00Z"),
                },
                {
                  name: "محمد حسینی",
                  team: "زیر ۱۶ سال",
                  birth: new Date("2010-11-02T09:00:00Z"),
                },
              ].map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.team}</TableCell>
                  <TableCell>{formatJalaliNumeric(row.birth)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">فعال</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">نمای کلی</TabsTrigger>
              <TabsTrigger value="training">تمرین</TabsTrigger>
              <TabsTrigger value="matches">مسابقات</TabsTrigger>
            </TabsList>
            <TabsContent
              value="overview"
              className="pt-3 text-sm text-muted-foreground"
            >
              محتوای نمای کلی
            </TabsContent>
            <TabsContent
              value="training"
              className="pt-3 text-sm text-muted-foreground"
            >
              محتوای تمرین
            </TabsContent>
            <TabsContent
              value="matches"
              className="pt-3 text-sm text-muted-foreground"
            >
              محتوای مسابقات
            </TabsContent>
          </Tabs>
        </div>
      </Section>

      <Section title="بازخورد">
        <div className="space-y-4">
          <Alert>
            <AlertTitle>اطلاع‌رسانی</AlertTitle>
            <AlertDescription>
              فهرست تمرین‌های این هفته به‌روزرسانی شد.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>
              ثبت حضور و غیاب انجام نشد. لطفاً دوباره تلاش کنید.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => toast.success("حضور و غیاب ثبت شد")}
            >
              Toast موفق
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error("ثبت اطلاعات انجام نشد")}
            >
              Toast خطا
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>افزودن بازیکن</DialogTitle>
                  <DialogDescription>
                    اطلاعات پایه بازیکن را وارد کنید.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="sg-dialog-name">نام</Label>
                  <Input id="sg-dialog-name" />
                </div>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Sheet</Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>فیلترها</SheetTitle>
                  <SheetDescription>
                    نتایج را بر اساس تیم و وضعیت محدود کنید.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Section>

      <Section title="حالت‌های صفحه">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">خالی</p>
            <EmptyState
              icon={Users}
              title="هنوز بازیکنی ثبت نشده است"
              description="با افزودن اولین بازیکن، فهرست تیم اینجا نمایش داده می‌شود."
              action={<Button size="sm">افزودن بازیکن</Button>}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">خطا</p>
            <ErrorState onRetry={() => toast.info("تلاش دوباره")} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">بارگذاری</p>
            <StatCardsSkeleton />
            <TableSkeleton rows={3} />
            <CardGridSkeleton count={3} />
          </div>
        </div>
      </Section>
    </div>
  );
}
