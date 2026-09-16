import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { TRYOUT_STATUS_LABEL } from "@/components/tryouts/tryout-meta";
import { parsePagination } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listTryouts } from "@/lib/services/tryout.service";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "استعدادیابی" };
export const dynamic = "force-dynamic";

export default async function TryoutsAdminPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const caller = await requireUser();
  const { page } = await props.searchParams;
  const pagination = parsePagination(
    new URLSearchParams(page ? { page } : undefined),
  );

  const { items, meta } = await listTryouts(caller, pagination);

  return (
    <>
      <PageHeader
        title="استعدادیابی"
        description="دوره‌های آزمون ورودی و درخواست‌های ثبت‌شده."
        actions={
          <Badge variant="secondary">{toPersianDigits(meta.total)} دوره</Badge>
        }
      />

      <DataTable
        rows={items}
        rowKey={(row) => row.id}
        empty={{
          icon: ClipboardList,
          title: "هنوز دوره‌ای تعریف نشده است",
          description:
            "دوره استعدادیابی با رده سنی و بازه ثبت‌نام تعریف می‌شود.",
        }}
        columns={[
          {
            id: "title",
            header: "عنوان",
            cell: (row) => (
              <Link
                href={`/dashboard/tryouts/${row.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {row.title}
              </Link>
            ),
          },
          {
            id: "band",
            header: "رده سنی",
            cell: (row) => `${row.ageGroup.code} · ${row.sport.name}`,
          },
          {
            id: "window",
            header: "مهلت ثبت‌نام",
            hideOnMobile: true,
            cell: (row) => formatJalali(row.closesAt),
          },
          {
            id: "applications",
            header: "درخواست‌ها",
            hideOnMobile: true,
            cell: (row) => toPersianDigits(row._count.applications),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (row) => (
              <Badge
                className={
                  row.status === "OPEN"
                    ? "bg-brand text-brand-foreground"
                    : undefined
                }
                variant={row.status === "OPEN" ? "default" : "outline"}
              >
                {TRYOUT_STATUS_LABEL[row.status]}
              </Badge>
            ),
          },
        ]}
      />
    </>
  );
}
