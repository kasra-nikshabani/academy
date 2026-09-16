import type { Metadata } from "next";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TryoutRegistration } from "@/components/tryouts/tryout-registration";
import {
  getPublicTryout,
  registrationWindow,
} from "@/lib/services/tryout.service";
import { birthYearWindow } from "@/lib/services/age-group";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "جزئیات استعدادیابی" };
export const dynamic = "force-dynamic";

export default async function TryoutPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const tryout = await getPublicTryout(slug);
  const window = registrationWindow(tryout);
  const years = birthYearWindow(tryout.ageGroup, tryout.season.startYear);

  return (
    <>
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            {tryout.title}
          </h1>
          <Badge
            className={
              window.open
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground"
            }
          >
            {window.open ? "ثبت‌نام باز" : "ثبت‌نام بسته"}
          </Badge>
        </div>

        {tryout.description ? (
          <p className="leading-8 text-muted-foreground">
            {tryout.description}
          </p>
        ) : null}
      </header>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
        <div className="bg-card p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            رده سنی
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {tryout.ageGroup.name} ({tryout.ageGroup.code}) —{" "}
            {tryout.sport.name}
          </dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">
            متولدین {toPersianDigits(years.from)} تا {toPersianDigits(years.to)}
          </dd>
        </div>

        <div className="bg-card p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            مهلت ثبت‌نام
          </dt>
          <dd className="mt-1 text-sm font-medium">
            تا {formatJalali(tryout.closesAt)}
          </dd>
          {tryout.heldAt ? (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              برگزاری: {formatJalali(tryout.heldAt)}
            </dd>
          ) : null}
        </div>

        {tryout.venue || tryout.city ? (
          <div className="bg-card p-4 sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              محل برگزاری
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {[tryout.venue, tryout.city].filter(Boolean).join(" — ")}
            </dd>
          </div>
        ) : null}
      </dl>

      {window.open ? (
        <TryoutRegistration
          slug={tryout.slug}
          seasonStartYear={tryout.season.startYear}
          birthYears={{ from: years.from, to: years.to }}
        />
      ) : (
        <Alert>
          <AlertTitle>ثبت‌نام این دوره باز نیست</AlertTitle>
          <AlertDescription>
            {window.reason} دوره‌های بعدی از صفحه استعدادیابی اعلام می‌شوند.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
