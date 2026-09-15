import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listSports } from "@/lib/services/academy.service";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "رشته‌های ورزشی" };
export const dynamic = "force-dynamic";

export default async function SportsPage() {
  const caller = await requireUser();
  const sports = await listSports(caller, true);

  return (
    <>
      <PageHeader
        title="رشته‌های ورزشی"
        description="هر رشته، رده‌های سنی، مدارس و تیم‌های خودش را دارد."
      />

      <DataTable
        rows={sports}
        rowKey={(sport) => sport.id}
        empty={{
          icon: Trophy,
          title: "هنوز رشته ورزشی ثبت نشده است",
          description:
            "با افزودن اولین رشته، رده‌های سنی و تیم‌های آن قابل تعریف می‌شوند.",
        }}
        columns={[
          {
            id: "name",
            header: "نام",
            cell: (sport) => <span className="font-medium">{sport.name}</span>,
          },
          {
            id: "slug",
            header: "شناسه",
            hideOnMobile: true,
            cell: (sport) => (
              <bdi dir="ltr" className="text-muted-foreground">
                <code>{sport.slug}</code>
              </bdi>
            ),
          },
          {
            id: "order",
            header: "ترتیب",
            hideOnMobile: true,
            cell: (sport) => toPersianDigits(sport.displayOrder),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (sport) =>
              sport.isActive ? (
                <Badge variant="secondary">فعال</Badge>
              ) : (
                <Badge variant="outline">غیرفعال</Badge>
              ),
          },
        ]}
      />
    </>
  );
}
