import type { Metadata } from "next";
import { Shapes } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth";
import {
  getActiveSeason,
  listAgeGroups,
  listSports,
} from "@/lib/services/academy.service";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "رده‌های سنی" };
export const dynamic = "force-dynamic";

export default async function AgeGroupsPage() {
  const caller = await requireUser();
  const [groups, sports, season] = await Promise.all([
    listAgeGroups(caller, undefined, true),
    listSports(caller, true),
    getActiveSeason(caller),
  ]);

  const sportName = new Map(sports.map((sport) => [sport.id, sport.name]));

  return (
    <>
      <PageHeader
        title="رده‌های سنی"
        description="رده‌ها بر اساس بازه سنی تعریف می‌شوند؛ سال‌های تولد مجاز از روی فصل جاری محاسبه می‌شود."
      />

      {season ? null : (
        <Alert>
          <AlertDescription>
            فصل فعالی تعریف نشده است، بنابراین سال‌های تولد قابل محاسبه نیستند.
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        rows={groups}
        rowKey={(group) => group.id}
        empty={{
          icon: Shapes,
          title: "هنوز رده سنی ثبت نشده است",
          description: "برای هر رشته ورزشی، رده‌های سنی خودش را تعریف کنید.",
        }}
        columns={[
          {
            id: "code",
            header: "کد",
            cell: (group) => (
              <bdi dir="ltr" className="font-medium">
                {group.code}
              </bdi>
            ),
          },
          {
            id: "name",
            header: "نام",
            cell: (group) => group.name,
          },
          {
            id: "sport",
            header: "رشته",
            hideOnMobile: true,
            cell: (group) => sportName.get(group.sportId) ?? "—",
          },
          {
            id: "ages",
            header: "بازه سنی",
            cell: (group) =>
              `${toPersianDigits(group.minAge)} تا ${toPersianDigits(group.maxAge)} سال`,
          },
          {
            id: "birthYears",
            header: "سال تولد مجاز",
            hideOnMobile: true,
            cell: (group) =>
              group.birthYears ? (
                <span className="text-muted-foreground">
                  {group.birthYears.label}
                </span>
              ) : (
                "—"
              ),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (group) =>
              group.isActive ? (
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
