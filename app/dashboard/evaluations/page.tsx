import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  EVALUATION_STATUS_LABEL,
  RECOMMENDATION_CLASS,
  RECOMMENDATION_LABEL,
  scoreTone,
} from "@/components/evaluations/evaluation-meta";
import { requireUser } from "@/lib/auth";
import { listEvaluations } from "@/lib/services/evaluation.service";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "ارزیابی‌ها" };
export const dynamic = "force-dynamic";

/**
 * A coach opens this and sees the players they have been asked to assess —
 * including trial players they could not otherwise reach, because the
 * assignment is their route in, not a tryout permission
 * (docs/BUSINESS_RULES.md §16).
 */
export default async function EvaluationsPage() {
  const caller = await requireUser();
  const evaluations = await listEvaluations(caller);

  const pending = evaluations.filter((row) => row.status === "DRAFT").length;

  return (
    <>
      <PageHeader
        title="ارزیابی‌ها"
        description="ارزیابی‌هایی که به شما سپرده شده و ارزیابی بازیکنان تیم‌های شما."
        actions={
          <div className="flex gap-2">
            <Badge variant="secondary">
              {toPersianDigits(pending)} در انتظار
            </Badge>
            <Badge variant="outline" asChild>
              <Link href="/dashboard/evaluations/templates">الگوها</Link>
            </Badge>
          </div>
        }
      />

      <DataTable
        rows={evaluations}
        rowKey={(row) => row.id}
        empty={{
          icon: ClipboardCheck,
          title: "ارزیابی‌ای به شما سپرده نشده است",
          description:
            "مدیر آکادمی ارزیابی بازیکنان آزمون را به مربی مشخصی می‌سپارد.",
        }}
        columns={[
          {
            id: "player",
            header: "بازیکن",
            cell: (row) => (
              <Link
                href={`/dashboard/evaluations/${row.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {row.player.person.firstName} {row.player.person.lastName}
              </Link>
            ),
          },
          {
            id: "context",
            header: "بابت",
            hideOnMobile: true,
            cell: (row) =>
              row.application ? (
                <span className="text-xs text-muted-foreground">
                  {row.application.tryout.title}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  ارزیابی دوره‌ای
                </span>
              ),
          },
          {
            id: "template",
            header: "الگو",
            hideOnMobile: true,
            cell: (row) => row.template.title,
          },
          {
            id: "score",
            header: "امتیاز کلی",
            cell: (row) => (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                  scoreTone(row.overallScore),
                )}
              >
                {row.overallScore === null
                  ? "—"
                  : `${toPersianDigits(row.overallScore)} از ۱۰`}
              </span>
            ),
          },
          {
            id: "recommendation",
            header: "نظر",
            hideOnMobile: true,
            cell: (row) =>
              row.recommendation ? (
                <Badge className={cn(RECOMMENDATION_CLASS[row.recommendation])}>
                  {RECOMMENDATION_LABEL[row.recommendation]}
                </Badge>
              ) : (
                "—"
              ),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (row) => (
              <div className="text-end">
                <Badge
                  variant={row.status === "SUBMITTED" ? "outline" : "default"}
                  className={
                    row.status === "DRAFT"
                      ? "bg-brand text-brand-foreground"
                      : undefined
                  }
                >
                  {EVALUATION_STATUS_LABEL[row.status]}
                </Badge>
                {row.submittedAt ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatJalali(row.submittedAt)}
                  </p>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
