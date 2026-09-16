import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, ListChecks, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/states/empty-state";
import {
  TRAINING_STATUS_LABEL,
  TRAINING_TYPE_LABEL,
} from "@/components/training/training-meta";
import { requireUser } from "@/lib/auth";
import { getTrainingSession } from "@/lib/services/training.service";
import { durationMinutes } from "@/lib/services/training-time";
import { formatJalaliLong, formatTimeRange } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";
import type { TrainingStatus } from "@/lib/generated/prisma/enums";

export const metadata: Metadata = { title: "جلسه تمرین" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<TrainingStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-brand text-brand-foreground",
  COMPLETED: "bg-success text-success-foreground",
  CANCELLED: "bg-warning text-warning-foreground",
};

/**
 * One training session.
 *
 * `getTrainingSession` refuses a session outside the caller's schedule scope
 * before it returns anything, so another team's id in the URL answers exactly
 * like an id that does not exist.
 */
export default async function TrainingSessionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireUser();
  const { id } = await props.params;
  const session = await getTrainingSession(caller, id);

  const minutes = durationMinutes(session);
  const exercises = session.plan?.exercises ?? [];

  return (
    <>
      <PageHeader
        title={session.team.name}
        description={formatJalaliLong(session.startsAt)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn(STATUS_BADGE[session.status])}>
              {TRAINING_STATUS_LABEL[session.status]}
            </Badge>
            <Badge variant="outline">{TRAINING_TYPE_LABEL[session.type]}</Badge>
          </div>
        }
      />

      {session.status === "CANCELLED" ? (
        <Alert>
          <AlertTitle>این جلسه لغو شده است</AlertTitle>
          <AlertDescription>
            {session.cancelReason ?? "دلیلی ثبت نشده است."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>مشخصات جلسه</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CalendarDays
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">تاریخ</dt>
                  <dd>{formatJalaliLong(session.startsAt)}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">ساعت</dt>
                  <dd>
                    <bdi>
                      {formatTimeRange(session.startsAt, session.endsAt)}
                    </bdi>
                    <span className="text-muted-foreground">
                      {" "}
                      ({toPersianDigits(minutes)} دقیقه)
                    </span>
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">مکان</dt>
                  <dd>{session.location ?? "ثبت نشده"}</dd>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <dt className="text-muted-foreground">فصل</dt>
                <dd>{session.season.name}</dd>
              </div>

              <div>
                <dt className="text-muted-foreground">رده سنی</dt>
                <dd>
                  {session.team.ageGroup.name} ({session.team.ageGroup.code})
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {session.plan ? session.plan.title : "برنامه تمرین"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exercises.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="برنامه‌ای به این جلسه متصل نیست"
                description="برنامه‌های تمرین در بخش «برنامه‌ها» نوشته می‌شوند و به جلسه متصل می‌شوند."
                action={
                  <Link
                    href="/dashboard/training/plans"
                    className="text-sm underline underline-offset-4"
                  >
                    مشاهده برنامه‌ها
                  </Link>
                }
              />
            ) : (
              <ol className="space-y-3">
                {exercises.map((exercise, index) => (
                  <li key={exercise.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-muted text-xs font-medium text-brand-foreground"
                    >
                      {toPersianDigits(index + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="font-medium">{exercise.title}</p>
                        {exercise.durationMinutes ? (
                          <span className="text-xs text-muted-foreground">
                            {toPersianDigits(exercise.durationMinutes)} دقیقه
                          </span>
                        ) : null}
                      </div>
                      {exercise.focus ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          تمرکز: {exercise.focus}
                        </p>
                      ) : null}
                      {exercise.description ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {exercise.description}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {session.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>یادداشت مربی</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 whitespace-pre-line">
              {session.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
