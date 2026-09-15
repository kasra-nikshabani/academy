import { BrandLockup } from "@/components/brand/brand-lockup";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <BrandLockup size="lg" />

      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          سامانه مدیریت آکادمی
        </h1>
        <p className="max-w-prose leading-8 text-muted-foreground">
          زیرساخت و Design System پروژه آماده است. صفحات عمومی، ورود کاربران و
          پنل‌های مدیریتی در فازهای بعدی توسعه اضافه می‌شوند.
        </p>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {[
          { label: "فاز جاری", value: "Phase 2 — Authentication" },
          { label: "تکمیل‌شده", value: "Foundation · Design System" },
          { label: "تیم", value: "فولاد مبارکه سپاهان" },
        ].map((item) => (
          <div key={item.label} className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-3 rounded-lg border border-brand/40 bg-brand-muted/40 p-4">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
        <p className="text-sm">
          مرجع Design System:{" "}
          <a
            href="/style-guide"
            className="decoration-brand-strong font-medium underline underline-offset-4"
          >
            راهنمای طراحی
          </a>
        </p>
      </div>
    </main>
  );
}
