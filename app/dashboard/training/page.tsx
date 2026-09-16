import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrainingWeek } from "@/components/training/training-week";
import { requireUser } from "@/lib/auth";
import {
  listScheduleTeams,
  listTrainingWeek,
} from "@/lib/services/training.service";
import { addDays, formatJalali, startOfWeek } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "تمرین" };
export const dynamic = "force-dynamic";

interface SearchParams {
  /** The Saturday of the week being shown, as `YYYY-MM-DD`. */
  week?: string;
  teamId?: string;
}

/** A week is addressed by its Saturday, so a link can be shared or bookmarked. */
function weekParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The training calendar.
 *
 * Week and team live in the URL rather than in component state (CLAUDE.md
 * §25): a coach sends "برنامه هفته بعد" to an assistant as a link, and the
 * page needs no client-side JavaScript to navigate.
 */
export default async function TrainingPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const caller = await requireUser();
  const { week, teamId } = await props.searchParams;

  const now = new Date();
  const requested = week ? new Date(week) : now;
  // A hand-edited `?week=` must not blank the page.
  const reference = Number.isNaN(requested.getTime()) ? now : requested;

  const weekStart = startOfWeek(reference);
  const weekEnd = addDays(weekStart, 7);

  const [sessions, teams] = await Promise.all([
    listTrainingWeek(caller, weekStart, weekEnd, teamId),
    listScheduleTeams(caller),
  ]);

  const linkTo = (params: SearchParams): string => {
    const query = new URLSearchParams();
    if (params.week) query.set("week", params.week);
    if (params.teamId) query.set("teamId", params.teamId);
    const suffix = query.toString();
    return suffix ? `/dashboard/training?${suffix}` : "/dashboard/training";
  };

  const range = `${formatJalali(weekStart)} تا ${formatJalali(addDays(weekStart, 6))}`;

  return (
    <>
      <PageHeader
        title="تمرین"
        description={range}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={linkTo({
                  week: weekParam(addDays(weekStart, -7)),
                  ...(teamId ? { teamId } : {}),
                })}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
                هفته قبل
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={linkTo({ ...(teamId ? { teamId } : {}) })}>
                این هفته
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={linkTo({
                  week: weekParam(addDays(weekStart, 7)),
                  ...(teamId ? { teamId } : {}),
                })}
              >
                هفته بعد
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        }
      />

      {teams.length > 1 ? (
        <nav aria-label="فیلتر تیم" className="flex flex-wrap gap-2">
          <Link href={linkTo({ ...(week ? { week } : {}) })}>
            <Badge
              variant={teamId ? "outline" : "default"}
              className={cn(!teamId && "bg-brand text-brand-foreground")}
            >
              همه تیم‌ها
            </Badge>
          </Link>
          {teams.map((team) => (
            <Link
              key={team.id}
              href={linkTo({ ...(week ? { week } : {}), teamId: team.id })}
            >
              <Badge
                variant={teamId === team.id ? "default" : "outline"}
                className={cn(
                  teamId === team.id && "bg-brand text-brand-foreground",
                )}
              >
                {team.name}
              </Badge>
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {toPersianDigits(sessions.length)} جلسه در این هفته
      </p>

      <TrainingWeek
        weekStart={weekStart}
        sessions={sessions}
        today={now}
        showTeam={!teamId}
      />
    </>
  );
}
