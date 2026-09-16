import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Can } from "@/components/auth/can";
import { getCurrentUser } from "@/lib/auth";
import { findRoleDefinition } from "@/lib/permissions/roles";
import { formatJalaliDateTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "داشبورد" };

/**
 * Landing page for a signed-in user.
 *
 * Role-specific dashboards arrive in Phase 16; this shows who the caller is
 * and what they may reach.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader
        title="خوش آمدید"
        description="پنل‌های نقش‌محور در فازهای بعدی اضافه می‌شوند."
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
        شما {toPersianDigits(user.permissions.length)} مجوز دارید.
      </p>
    </>
  );
}
