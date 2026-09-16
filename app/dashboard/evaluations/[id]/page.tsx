import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvaluationSheet } from "@/components/evaluations/evaluation-sheet";
import {
  DIMENSION_LABEL,
  DIMENSION_ORDER,
  EVALUATION_STATUS_LABEL,
  RECOMMENDATION_CLASS,
  RECOMMENDATION_LABEL,
  scoreTone,
} from "@/components/evaluations/evaluation-meta";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getEvaluation } from "@/lib/services/evaluation.service";
import { formatJalali, toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "ارزیابی بازیکن" };
export const dynamic = "force-dynamic";

export default async function EvaluationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireUser();
  const { id } = await props.params;
  const evaluation = await getEvaluation(caller, id);

  const editable =
    evaluation.status === "DRAFT" && hasPermission(caller, "evaluation:write");

  return (
    <>
      <PageHeader
        title={`${evaluation.player.person.firstName} ${evaluation.player.person.lastName}`}
        description={
          evaluation.application
            ? `${evaluation.application.tryout.title} · ${evaluation.template.title}`
            : evaluation.template.title
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {evaluation.overallScore !== null ? (
              <Badge
                className={cn(
                  "tabular-nums",
                  scoreTone(evaluation.overallScore),
                )}
              >
                {toPersianDigits(evaluation.overallScore)} از ۱۰
              </Badge>
            ) : null}
            <Badge variant="outline">
              {EVALUATION_STATUS_LABEL[evaluation.status]}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>مشخصات</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">کد بازیکن</dt>
                <dd>
                  <bdi dir="ltr">
                    <code>{evaluation.player.playerCode}</code>
                  </bdi>
                </dd>
              </div>
              {evaluation.player.person.dateOfBirth ? (
                <div>
                  <dt className="text-muted-foreground">سال تولد</dt>
                  <dd>
                    {toPersianDigits(
                      toJalali(evaluation.player.person.dateOfBirth).jy,
                    )}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">ارزیاب</dt>
                <dd>
                  {evaluation.evaluator.person.firstName}{" "}
                  {evaluation.evaluator.person.lastName}
                </dd>
              </div>
              {evaluation.submittedAt ? (
                <div>
                  <dt className="text-muted-foreground">تاریخ ثبت</dt>
                  <dd>{formatJalali(evaluation.submittedAt)}</dd>
                </div>
              ) : null}
              {evaluation.recommendation ? (
                <div>
                  <dt className="text-muted-foreground">نظر ارزیاب</dt>
                  <dd className="mt-1">
                    <Badge
                      className={cn(
                        RECOMMENDATION_CLASS[evaluation.recommendation],
                      )}
                    >
                      {RECOMMENDATION_LABEL[evaluation.recommendation]}
                    </Badge>
                  </dd>
                </div>
              ) : null}
            </dl>

            {/* The four numbers the club reports on (CLAUDE.md §14). */}
            {Object.keys(evaluation.dimensions).length > 0 ? (
              <dl className="mt-4 space-y-2 border-t border-border pt-4">
                {DIMENSION_ORDER.map((dimension) => {
                  const value = evaluation.dimensions[dimension];
                  if (value === undefined) return null;

                  return (
                    <div
                      key={dimension}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <dt className="text-muted-foreground">
                        {DIMENSION_LABEL[dimension]}
                      </dt>
                      <dd className="flex flex-1 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                        >
                          <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${value * 10}%` }}
                          />
                        </span>
                        <span className="tabular-nums">
                          {toPersianDigits(value)}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{evaluation.template.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <EvaluationSheet
              evaluationId={evaluation.id}
              criteria={evaluation.template.criteria}
              initialScores={evaluation.scores.map((score) => ({
                criterionId: score.criterionId,
                score: score.score,
              }))}
              initial={{
                recommendation: evaluation.recommendation,
                strengths: evaluation.strengths,
                weaknesses: evaluation.weaknesses,
                notes: evaluation.notes,
              }}
              editable={editable}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
