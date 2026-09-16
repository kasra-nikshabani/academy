import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listSeasons } from "@/lib/services/academy.service";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "فصل‌ها" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  UPCOMING: "پیش‌رو",
  ACTIVE: "جاری",
  COMPLETED: "پایان‌یافته",
  ARCHIVED: "بایگانی",
} as const;

export default async function SeasonsPage() {
  const caller = await requireUser();
  const seasons = await listSeasons(caller);

  return (
    <>
      <PageHeader
        title="فصل‌ها"
        description="سال شروع فصل، مبنای محاسبه رده سنی بازیکنان است. در هر زمان فقط یک فصل می‌تواند جاری باشد."
      />

      <DataTable
        rows={seasons}
        rowKey={(season) => season.id}
        empty={{
          icon: CalendarDays,
          title: "هنوز فصلی ثبت نشده است",
          description:
            "بدون فصل جاری، رده‌های سنی قابل محاسبه نیستند و ثبت‌نام ممکن نیست.",
        }}
        columns={[
          {
            id: "name",
            header: "فصل",
            cell: (season) => (
              <span className="font-medium">{season.name}</span>
            ),
          },
          {
            id: "startYear",
            header: "سال مبنا",
            cell: (season) => toPersianDigits(season.startYear),
          },
          {
            id: "range",
            header: "بازه",
            hideOnMobile: true,
            cell: (season) => (
              <span className="text-muted-foreground">
                {formatJalali(season.startDate)} تا{" "}
                {formatJalali(season.endDate)}
              </span>
            ),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (season) =>
              season.status === "ACTIVE" ? (
                <Badge className="bg-brand text-brand-foreground">
                  {STATUS_LABEL[season.status]}
                </Badge>
              ) : (
                <Badge variant="outline">{STATUS_LABEL[season.status]}</Badge>
              ),
          },
        ]}
      />
    </>
  );
}
