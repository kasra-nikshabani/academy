import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import {
  DIMENSION_LABEL,
  DIMENSION_ORDER,
} from "@/components/evaluations/evaluation-meta";
import { requireUser } from "@/lib/auth";
import { listEvaluationTemplates } from "@/lib/services/evaluation.service";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "الگوهای ارزیابی" };
export const dynamic = "force-dynamic";

/**
 * The club's yardsticks.
 *
 * A template groups its criteria under the four dimensions the academy
 * reports on, and each criterion carries a weight — which is the whole reason
 * the engine is configurable rather than a fixed list of four marks
 * (CLAUDE.md §14).
 */
export default async function EvaluationTemplatesPage() {
  const caller = await requireUser();
  const templates = await listEvaluationTemplates(caller);

  if (templates.length === 0) {
    return (
      <>
        <PageHeader title="الگوهای ارزیابی" />
        <EmptyState
          icon={Layers}
          title="هنوز الگویی تعریف نشده است"
          description="الگوی ارزیابی، مجموعه معیارهایی است که بازیکن با آن سنجیده می‌شود."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="الگوهای ارزیابی"
        description="معیارها زیر چهار بُعد فنی، بدنی، ذهنی و کلی گروه‌بندی می‌شوند."
        actions={
          <Badge variant="secondary">
            {toPersianDigits(templates.length)} الگو
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="text-base">{template.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {template.sport.name}
                {template.ageGroup
                  ? ` · ${template.ageGroup.code}`
                  : " · همه رده‌ها"}
                {" · "}
                {toPersianDigits(template._count.evaluations)} ارزیابی
              </p>

              {template.description ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {template.description}
                </p>
              ) : null}

              {DIMENSION_ORDER.map((dimension) => {
                const group = template.criteria.filter(
                  (criterion) => criterion.dimension === dimension,
                );
                if (group.length === 0) return null;

                return (
                  <div key={dimension}>
                    <p className="text-xs font-medium">
                      {DIMENSION_LABEL[dimension]}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {group.map((criterion) => (
                        <li
                          key={criterion.id}
                          className="flex items-baseline justify-between gap-2 text-sm"
                        >
                          <span>{criterion.title}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            از {toPersianDigits(criterion.maxScore)}
                            {criterion.weight > 1
                              ? ` · ضریب ${toPersianDigits(criterion.weight)}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
