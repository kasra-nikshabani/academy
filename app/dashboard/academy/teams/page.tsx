import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listTeams } from "@/lib/services/academy.service";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "تیم‌ها" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const caller = await requireUser();
  const { items: teams, total } = await listTeams(caller, {
    includeInactive: true,
  });

  return (
    <>
      <PageHeader
        title="تیم‌ها"
        description={`${toPersianDigits(total)} تیم ثبت شده است. تیم‌ها به فصل وابسته نیستند؛ عضویت بازیکنان است که فصل دارد.`}
      />

      <DataTable
        rows={teams}
        rowKey={(team) => team.id}
        empty={{
          icon: Users,
          title: "هنوز تیمی ثبت نشده است",
          description: "هر تیم به یک رشته ورزشی و یک رده سنی تعلق دارد.",
        }}
        columns={[
          {
            id: "name",
            header: "تیم",
            cell: (team) => <span className="font-medium">{team.name}</span>,
          },
          {
            id: "sport",
            header: "رشته",
            hideOnMobile: true,
            cell: (team) => team.sport.name,
          },
          {
            id: "ageGroup",
            header: "رده سنی",
            cell: (team) => (
              <span>
                <bdi dir="ltr">{team.ageGroup.code}</bdi>
                <span className="text-muted-foreground">
                  {" "}
                  · {team.ageGroup.name}
                </span>
              </span>
            ),
          },
          {
            id: "birthYears",
            header: "سال تولد مجاز",
            hideOnMobile: true,
            cell: (team) =>
              team.birthYears ? (
                <span className="text-muted-foreground">
                  {team.birthYears.label}
                </span>
              ) : (
                "—"
              ),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (team) =>
              team.isActive ? (
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
