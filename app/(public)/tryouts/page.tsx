import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { listPublicTryouts } from "@/lib/services/tryout.service";
import { registrationWindow } from "@/lib/services/tryout.service";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "استعدادیابی" };
export const dynamic = "force-dynamic";

/**
 * The public list of trials.
 *
 * Shows trials that are open *and* ones whose registration has closed but
 * which have been announced — a family who missed the deadline should find
 * that out here rather than wonder whether they had the wrong link.
 */
export default async function TryoutsPage() {
  const tryouts = await listPublicTryouts();

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">استعدادیابی</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          آزمون‌های ورودی آکادمی فولاد مبارکه سپاهان. برای ثبت‌نام، شماره موبایل
          خود را تأیید می‌کنید و سپس اطلاعات بازیکن را وارد می‌کنید.
        </p>
      </header>

      {tryouts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="در حال حاضر استعدادیابی فعالی نیست"
          description="دوره‌های بعدی از همین صفحه اعلام می‌شوند."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tryouts.map((tryout) => {
            const window = registrationWindow(tryout);

            return (
              <li key={tryout.id}>
                <Link
                  href={`/tryouts/${tryout.slug}`}
                  className="block h-full rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium text-balance">{tryout.title}</h2>
                    <Badge
                      className={
                        window.open
                          ? "bg-brand text-brand-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {window.open ? "ثبت‌نام باز" : "بسته"}
                    </Badge>
                  </div>

                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">رده سنی</dt>
                      <dd>
                        {tryout.ageGroup.name} ({tryout.ageGroup.code}) ·{" "}
                        {tryout.sport.name}
                      </dd>
                    </div>
                    {tryout.city ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3" aria-hidden="true" />
                        <dt className="sr-only">شهر</dt>
                        <dd>{tryout.city}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="inline">مهلت ثبت‌نام: </dt>
                      <dd className="inline">
                        {formatJalali(tryout.closesAt)}
                      </dd>
                    </div>
                    {tryout.capacity ? (
                      <div>
                        <dt className="inline">ظرفیت: </dt>
                        <dd className="inline">
                          {toPersianDigits(tryout.capacity)} نفر
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
