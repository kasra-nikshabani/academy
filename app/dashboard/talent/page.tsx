import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Gavel, UserSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { TalentFunnel } from "@/components/talent/talent-funnel";
import {
  RECOMMENDATION_CLASS,
  RECOMMENDATION_LABEL,
  scoreTone,
} from "@/components/evaluations/evaluation-meta";
import { requireUser } from "@/lib/auth";
import {
  getPipelineQueues,
  getTalentPipeline,
} from "@/lib/services/talent.service";
import { formatJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "قیف استعدادیابی" };
export const dynamic = "force-dynamic";

type Queues = Awaited<ReturnType<typeof getPipelineQueues>>;
type QueueRow = Queues["awaitingScreening"][number];

/**
 * The pipeline across every trial.
 *
 * The funnel is the headline, but the three queues below it are the point: a
 * manager opens this to find out what is waiting on a person, not to admire a
 * chart. Each row links straight to the trial page where the action lives,
 * rather than repeating those controls here — one place decides, and the
 * queue only says who is waiting.
 */
export default async function TalentPipelinePage(props: {
  searchParams: Promise<{ allSeasons?: string }>;
}) {
  const caller = await requireUser();
  const { allSeasons } = await props.searchParams;
  const filters = { allSeasons: allSeasons === "true" };

  const [pipeline, queues] = await Promise.all([
    getTalentPipeline(caller, filters),
    getPipelineQueues(caller, filters),
  ]);

  const metrics = [
    { label: "استعدادیابی باز", value: pipeline.openTryouts },
    { label: "کل درخواست‌ها", value: pipeline.counts.applied },
    { label: "در انتظار غربالگری", value: pipeline.counts.pendingScreening },
    { label: "ارزیابی ناتمام", value: pipeline.unfinishedEvaluations },
    { label: "پذیرفته‌شده", value: pipeline.counts.accepted },
    { label: "در جریان", value: pipeline.stillOpen },
  ];

  const queueSections: Array<{
    key: keyof Queues;
    title: string;
    hint: string;
    icon: typeof ClipboardCheck;
    rows: QueueRow[];
  }> = [
    {
      key: "awaitingScreening",
      title: "در انتظار غربالگری",
      hint: "هنوز کسی مدارک را بررسی نکرده است.",
      icon: ClipboardCheck,
      rows: queues.awaitingScreening,
    },
    {
      key: "awaitingEvaluator",
      title: "در انتظار ارزیاب",
      hint: "از غربالگری گذشته‌اند و هنوز به مربی سپرده نشده‌اند.",
      icon: UserSearch,
      rows: queues.awaitingEvaluator,
    },
    {
      key: "awaitingDecision",
      title: "در انتظار تصمیم",
      hint: "ارزیابی شده‌اند و منتظر تصمیم نهایی هستند.",
      icon: Gavel,
      rows: queues.awaitingDecision,
    },
  ];

  return (
    <>
      <PageHeader
        title="قیف استعدادیابی"
        description={
          pipeline.seasonName
            ? `فصل ${pipeline.seasonName} — از ثبت درخواست تا پیوستن به تیم.`
            : "همه فصل‌ها — از ثبت درخواست تا پیوستن به تیم."
        }
        actions={
          <div className="flex items-center gap-2">
            {pipeline.conversion !== null ? (
              <Badge className="bg-brand text-brand-foreground tabular-nums">
                نرخ پذیرش {toPersianDigits(pipeline.conversion)}٪
              </Badge>
            ) : null}
            <Badge variant="outline" asChild>
              <Link
                href={
                  filters.allSeasons
                    ? "/dashboard/talent"
                    : "/dashboard/talent?allSeasons=true"
                }
              >
                {filters.allSeasons ? "فقط فصل جاری" : "همه فصل‌ها"}
              </Link>
            </Badge>
          </div>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>قیف</CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.counts.applied === 0 ? (
              <EmptyState
                icon={UserSearch}
                title="هنوز درخواستی در این فصل ثبت نشده است"
                description="با باز شدن اولین دوره استعدادیابی، قیف اینجا شکل می‌گیرد."
              />
            ) : (
              <TalentFunnel stages={pipeline.stages} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>کنار رفتن‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                {
                  label: "رد در غربالگری",
                  value: pipeline.counts.rejectedAtScreening,
                },
                {
                  label: "رد پس از ارزیابی",
                  value: pipeline.counts.rejectedAfterScreening,
                },
                { label: "فهرست انتظار", value: pipeline.counts.waitlisted },
                { label: "لغو‌شده", value: pipeline.counts.cancelled },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2"
                >
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {toPersianDigits(item.value)}
                  </dd>
                </div>
              ))}
            </dl>

            {/*
              Not an error, and not hidden either: a manager who watched the
              trial themselves may take a player nobody filed a sheet for.
              Worth knowing how often that happens.
            */}
            {pipeline.acceptedWithoutEvaluation > 0 ? (
              <p className="mt-4 flex items-start gap-2 rounded-md bg-warning/15 p-2.5 text-xs leading-5">
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {toPersianDigits(pipeline.acceptedWithoutEvaluation)} بازیکن
                  بدون ثبت ارزیابی پذیرفته شده‌اند.
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {queueSections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle className="text-base">
                {section.title}
                <Badge variant="secondary" className="ms-2">
                  {toPersianDigits(section.rows.length)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section.rows.length === 0 ? (
                <EmptyState
                  icon={section.icon}
                  title="چیزی در انتظار نیست"
                  description={section.hint}
                />
              ) : (
                <ul className="divide-y divide-border">
                  {section.rows.map((row) => (
                    <li key={row.id} className="py-2 first:pt-0 last:pb-0">
                      <Link
                        href={`/dashboard/tryouts/${row.tryoutId}`}
                        className="block rounded-md px-1 py-1 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <p className="text-sm font-medium">
                            {row.player.person.firstName}{" "}
                            {row.player.person.lastName}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatJalali(row.submittedAt)}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.tryout.title}
                        </p>

                        {row.evaluations.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {row.evaluations.map((evaluation) => (
                              <span
                                key={evaluation.id}
                                className={cn(
                                  "rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                                  scoreTone(evaluation.overallScore),
                                )}
                              >
                                {evaluation.overallScore === null
                                  ? "—"
                                  : toPersianDigits(evaluation.overallScore)}
                              </span>
                            ))}
                            {row.evaluations[0]?.recommendation ? (
                              <Badge
                                className={cn(
                                  "text-[11px]",
                                  RECOMMENDATION_CLASS[
                                    row.evaluations[0].recommendation
                                  ],
                                )}
                              >
                                {
                                  RECOMMENDATION_LABEL[
                                    row.evaluations[0].recommendation
                                  ]
                                }
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
