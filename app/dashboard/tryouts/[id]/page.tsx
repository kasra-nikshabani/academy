import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ApplicationActions } from "@/components/tryouts/application-actions";
import {
  APPLICATION_STATUS_CLASS,
  APPLICATION_STATUS_LABEL,
  SCREENING_STATUS_LABEL,
  TRYOUT_STATUS_LABEL,
} from "@/components/tryouts/tryout-meta";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listTeams } from "@/lib/services/academy.service";
import { listStaff } from "@/lib/services/people.service";
import {
  listEvaluationTemplates,
  summariseApplicationEvaluations,
} from "@/lib/services/evaluation.service";
import { isUnscoped } from "@/lib/permissions";
import {
  getTryout,
  getTryoutFunnel,
  listTryoutApplications,
} from "@/lib/services/tryout.service";
import { formatJalali, toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "درخواست‌های استعدادیابی" };
export const dynamic = "force-dynamic";

/**
 * One trial: the funnel, and every application in it.
 *
 * The funnel numbers are counted in the database rather than derived from the
 * rows on this page — a page of applications would give the wrong total the
 * moment there are more of them than fit.
 */
export default async function TryoutApplicationsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireUser();
  const { id } = await props.params;

  const tryout = await getTryout(caller, id);
  const [applications, funnel, teams, staff, templates] = await Promise.all([
    listTryoutApplications(caller, id),
    getTryoutFunnel(caller, id),
    listTeams(caller, { ageGroupId: tryout.ageGroupId }),
    listStaff(caller, { page: 1, pageSize: 100 }),
    listEvaluationTemplates(caller, { sportId: tryout.sportId }),
  ]);

  const evaluationSummary = await summariseApplicationEvaluations(
    caller,
    applications.map((application) => application.id),
  );

  const canDecide = hasPermission(caller, "tryout:decide");
  const canAssignEvaluation = isUnscoped(caller);

  const evaluators = staff.items.map((member) => ({
    id: member.id,
    name: `${member.person.firstName} ${member.person.lastName}`,
  }));

  const metrics = [
    { label: "کل درخواست‌ها", value: funnel.total },
    { label: "در انتظار غربالگری", value: funnel.pendingScreening },
    { label: "در ارزیابی", value: funnel.evaluation },
    { label: "پذیرفته‌شده", value: funnel.accepted },
    { label: "فهرست انتظار", value: funnel.waitlist },
    { label: "رد‌شده", value: funnel.rejected },
  ];

  return (
    <>
      <PageHeader
        title={tryout.title}
        description={`${tryout.ageGroup.name} (${tryout.ageGroup.code}) · مهلت ثبت‌نام تا ${formatJalali(tryout.closesAt)}`}
        actions={
          <Badge
            className={
              tryout.status === "OPEN"
                ? "bg-brand text-brand-foreground"
                : undefined
            }
            variant={tryout.status === "OPEN" ? "default" : "outline"}
          >
            {TRYOUT_STATUS_LABEL[tryout.status]}
          </Badge>
        }
      />

      <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-card p-3">
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">
              {toPersianDigits(metric.value)}
            </dd>
          </div>
        ))}
      </dl>

      <DataTable
        rows={applications}
        rowKey={(row) => row.id}
        empty={{
          icon: ClipboardList,
          title: "هنوز درخواستی ثبت نشده است",
          description: "درخواست‌ها از صفحه عمومی استعدادیابی ثبت می‌شوند.",
        }}
        columns={[
          {
            id: "player",
            header: "بازیکن",
            cell: (row) => (
              <div>
                <p className="font-medium">
                  {row.player.person.firstName} {row.player.person.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.player.person.dateOfBirth
                    ? `متولد ${toPersianDigits(toJalali(row.player.person.dateOfBirth).jy)}`
                    : "بدون تاریخ تولد"}
                </p>
              </div>
            ),
          },
          {
            id: "tracking",
            header: "کد پیگیری",
            hideOnMobile: true,
            cell: (row) => (
              <bdi dir="ltr" className="text-muted-foreground">
                <code>{row.trackingCode}</code>
              </bdi>
            ),
          },
          {
            id: "screening",
            header: "غربالگری",
            hideOnMobile: true,
            cell: (row) =>
              row.screening
                ? SCREENING_STATUS_LABEL[row.screening.status]
                : "—",
          },
          {
            id: "evaluation",
            header: "ارزیابی",
            hideOnMobile: true,
            cell: (row) => {
              const summary = evaluationSummary.get(row.id);
              if (!summary || summary.average === null) return "—";
              return (
                <span className="text-sm tabular-nums">
                  {toPersianDigits(summary.average)} از ۱۰
                  <span className="ms-1 text-xs text-muted-foreground">
                    ({toPersianDigits(summary.submitted)} ارزیاب)
                  </span>
                </span>
              );
            },
          },
          {
            id: "status",
            header: "وضعیت",
            cell: (row) => (
              <Badge className={cn(APPLICATION_STATUS_CLASS[row.status])}>
                {APPLICATION_STATUS_LABEL[row.status]}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: "اقدام",
            className: "min-w-56",
            cell: (row) => (
              <ApplicationActions
                applicationId={row.id}
                status={row.status}
                screeningStatus={row.screening?.status ?? null}
                teams={teams.items.map((team) => ({
                  id: team.id,
                  name: team.name,
                }))}
                canDecide={canDecide}
                canAssignEvaluation={canAssignEvaluation}
                evaluators={evaluators}
                templates={templates.map((template) => ({
                  id: template.id,
                  title: template.title,
                }))}
                playerId={row.playerId}
                evaluationCount={evaluationSummary.get(row.id)?.submitted ?? 0}
              />
            ),
          },
        ]}
      />
    </>
  );
}
