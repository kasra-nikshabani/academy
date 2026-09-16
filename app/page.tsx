import Link from "next/link";
import { ArrowLeft, ClipboardList, Search } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { Button } from "@/components/ui/button";
import { listPublicTryouts } from "@/lib/services/tryout.service";
import { registrationWindow } from "@/lib/services/tryout.service";
import { toPersianDigits } from "@/lib/utils/number";

export const dynamic = "force-dynamic";

/**
 * The public front door.
 *
 * It used to describe the build itself. Now that there is something a visitor
 * can actually do — register a child for a trial — that is what it leads with,
 * and the count is read from the database rather than written into the page.
 */
export default async function HomePage() {
  const tryouts = await listPublicTryouts();
  const open = tryouts.filter((tryout) => registrationWindow(tryout).open);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <BrandLockup size="lg" />

      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          آکادمی فولاد مبارکه سپاهان
        </h1>
        <p className="max-w-prose leading-8 text-muted-foreground">
          مدارس ورزشی، تیم‌های پایه و استعدادیابی باشگاه. برای شرکت در آزمون
          ورودی، از فهرست دوره‌های استعدادیابی ثبت‌نام کنید.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/tryouts">
            <Search aria-hidden="true" />
            دوره‌های استعدادیابی
            {open.length > 0 ? (
              <span className="rounded-full bg-brand-foreground/10 px-1.5 text-xs">
                {toPersianDigits(open.length)} دوره باز
              </span>
            ) : null}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/tryouts/status">
            <ClipboardList aria-hidden="true" />
            پیگیری درخواست
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/login">
            ورود اعضا
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
      </div>

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
