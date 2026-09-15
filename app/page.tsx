export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="size-3 rounded-full bg-brand" />
        <p className="text-sm font-medium text-muted-foreground">
          SEPahan Academy OS
        </p>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        سامانه مدیریت آکادمی باشگاه فولاد مبارکه سپاهان
      </h1>

      <p className="max-w-prose leading-8 text-muted-foreground">
        زیرساخت پروژه آماده است. صفحات عمومی، ورود کاربران و پنل‌های مدیریتی در
        فازهای بعدی توسعه اضافه می‌شوند.
      </p>

      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {[
          { label: "فاز جاری", value: "Phase 0 — Foundation" },
          { label: "وضعیت", value: "زیرساخت برپا شد" },
          { label: "فاز بعدی", value: "Phase 1 — Design System" },
        ].map((item) => (
          <div key={item.label} className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
