import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { formatJalaliDateTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "داشبورد" };

/**
 * Placeholder landing for a signed-in user.
 *
 * The role-specific dashboards arrive in Phase 16; this page exists so the
 * session can be proven end to end — and it is the authoritative access check,
 * not the middleware.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-sidebar px-6 py-4 text-sidebar-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <BrandLockup size="sm" className="[&_p:last-child]:text-white/70" />
          <SignOutButton>
            <LogOut className="size-4" />
            خروج
          </SignOutButton>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-8">
        <PageHeader
          title="خوش آمدید"
          description="ورود شما با موفقیت انجام شد. پنل‌های نقش‌محور در فازهای بعدی اضافه می‌شوند."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">حساب کاربری</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">شماره موبایل</span>
              <bdi dir="ltr" className="font-medium">
                {toPersianDigits(user.mobile)}
              </bdi>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">وضعیت</span>
              <Badge variant="secondary">فعال</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">آخرین ورود</span>
              <span className="font-medium">
                {user.lastLoginAt
                  ? formatJalaliDateTime(user.lastLoginAt)
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          نقش‌ها و دسترسی‌ها در Phase 3 (RBAC) اضافه می‌شوند.
        </p>
      </main>
    </div>
  );
}
