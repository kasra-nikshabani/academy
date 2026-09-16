import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { TRAINING_TYPE_LABEL } from "@/components/training/training-meta";
import { requireUser } from "@/lib/auth";
import { listTrainingPlans } from "@/lib/services/training.service";
import { parsePagination } from "@/lib/api";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "برنامه‌های تمرین" };
export const dynamic = "force-dynamic";

/**
 * The plans a caller may read: their own teams', plus the academy's shared
 * ones. A plan is reusable — the same programme runs over several sessions —
 * which is why it is a record of its own rather than fields on a session.
 */
export default async function TrainingPlansPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const caller = await requireUser();
  const { page } = await props.searchParams;
  const pagination = parsePagination(
    new URLSearchParams(page ? { page } : undefined),
  );

  const { items, meta } = await listTrainingPlans(caller, pagination);

  return (
    <>
      <PageHeader
        title="برنامه‌های تمرین"
        description="برنامه‌ها بین جلسات مشترک‌اند؛ هر جلسه می‌تواند یکی از آن‌ها را دنبال کند."
        actions={
          <Badge variant="secondary">
            {toPersianDigits(meta.total)} برنامه
          </Badge>
        }
      />

      <DataTable
        rows={items}
        rowKey={(row) => row.id}
        empty={{
          icon: ClipboardList,
          title: "هنوز برنامه‌ای نوشته نشده است",
          description:
            "برنامه تمرین، فهرست مرتب تمرین‌هایی است که یک جلسه دنبال می‌کند.",
        }}
        columns={[
          {
            id: "title",
            header: "عنوان",
            cell: (row) => <span className="font-medium">{row.title}</span>,
          },
          {
            id: "team",
            header: "تیم",
            cell: (row) =>
              row.team ? (
                row.team.name
              ) : (
                <Badge variant="outline">عمومی آکادمی</Badge>
              ),
          },
          {
            id: "type",
            header: "نوع",
            hideOnMobile: true,
            cell: (row) => TRAINING_TYPE_LABEL[row.type],
          },
          {
            id: "exercises",
            header: "تمرین‌ها",
            hideOnMobile: true,
            cell: (row) => toPersianDigits(row.exercises.length),
          },
          {
            id: "sessions",
            header: "جلسات",
            hideOnMobile: true,
            cell: (row) => toPersianDigits(row._count.sessions),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (row) =>
              row.isActive ? (
                <Badge className="bg-success text-success-foreground">
                  فعال
                </Badge>
              ) : (
                <Badge variant="outline">بایگانی</Badge>
              ),
          },
        ]}
      />
    </>
  );
}
