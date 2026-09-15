import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Can } from "@/components/auth/can";
import { findRoleDefinition } from "@/lib/permissions/roles";
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
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">نقش‌ها</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {user.roles.length === 0 ? (
                  <span className="text-muted-foreground">نقشی تعریف نشده</span>
                ) : (
                  user.roles.map((key) => (
                    <Badge key={key} className="bg-brand text-brand-foreground">
                      {findRoleDefinition(key).name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">آخرین ورود</span>
              <span className="font-medium">
                {user.account.lastLoginAt
                  ? formatJalaliDateTime(user.account.lastLoginAt)
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Can user={user} permission="user:read">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مدیریت کاربران</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                این بخش فقط برای کاربرانی نمایش داده می‌شود که مجوز
                <code className="mx-1">user:read</code> دارند.
              </p>
              <p>
                پنهان بودن آن یک کنترل امنیتی نیست — همان مجوز در لایه Service
                دوباره بررسی می‌شود.
              </p>
            </CardContent>
          </Card>
        </Can>

        <p className="text-sm text-muted-foreground">
          شما {toPersianDigits(user.permissions.length)} مجوز دارید. پنل‌های
          نقش‌محور در فازهای بعدی اضافه می‌شوند.
        </p>
      </main>
    </div>
  );
}
