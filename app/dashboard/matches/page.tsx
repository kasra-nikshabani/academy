import type { Metadata } from "next";
import Link from "next/link";
import { Swords } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import {
  HOME_AWAY_LABEL,
  MATCH_STATUS_CLASS,
  MATCH_STATUS_LABEL,
  OUTCOME_CLASS,
  OUTCOME_LABEL,
} from "@/components/matches/match-meta";
import { parsePagination } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listMatches } from "@/lib/services/match.service";
import { matchOutcome } from "@/lib/services/match-result";
import { formatJalali, formatTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "مسابقات" };
export const dynamic = "force-dynamic";

/**
 * Fixtures and results.
 *
 * Split at today rather than paginated as one list: a coach opening this
 * wants the next match first and the last result second, and a single
 * date-ordered page buries whichever of the two they came for.
 */
export default async function MatchesPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const caller = await requireUser();
  const { page } = await props.searchParams;
  const pagination = parsePagination(
    new URLSearchParams(page ? { page } : undefined),
  );

  const { items, meta } = await listMatches(caller, {
    ...pagination,
    pageSize: 50,
  });

  const now = new Date();
  const upcoming = items
    .filter(
      (match) =>
        match.kickoffAt >= now &&
        match.status !== "CANCELLED" &&
        match.status !== "COMPLETED",
    )
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

  const past = items.filter((match) => !upcoming.includes(match));

  const sections = [
    { key: "upcoming", title: "مسابقات پیش‌رو", rows: upcoming },
    { key: "past", title: "نتایج", rows: past },
  ];

  return (
    <>
      <PageHeader
        title="مسابقات"
        description="برنامه بازی‌ها، ترکیب و آمار بازیکنان."
        actions={
          <Badge variant="secondary">
            {toPersianDigits(meta.total)} مسابقه
          </Badge>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="هنوز مسابقه‌ای ثبت نشده است"
          description="مسابقه با حریف، تاریخ و محل برگزاری ثبت می‌شود."
        />
      ) : (
        sections.map((section) =>
          section.rows.length === 0 ? null : (
            <section key={section.key} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {section.title}
              </h2>

              <ul className="grid gap-2 sm:grid-cols-2">
                {section.rows.map((match) => {
                  const outcome = matchOutcome(match);

                  return (
                    <li key={match.id}>
                      <Link
                        href={`/dashboard/matches/${match.id}`}
                        className="block rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">
                            {match.team.name}
                            <span className="mx-1.5 text-muted-foreground">
                              −
                            </span>
                            {match.opponent}
                          </p>

                          {outcome ? (
                            <Badge className={cn(OUTCOME_CLASS[outcome])}>
                              {OUTCOME_LABEL[outcome]}{" "}
                              <bdi dir="ltr" className="tabular-nums">
                                {toPersianDigits(match.goalsFor ?? 0)}–
                                {toPersianDigits(match.goalsAgainst ?? 0)}
                              </bdi>
                            </Badge>
                          ) : (
                            <Badge
                              className={cn(MATCH_STATUS_CLASS[match.status])}
                            >
                              {MATCH_STATUS_LABEL[match.status]}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {formatJalali(match.kickoffAt)}
                          {" · "}
                          <bdi dir="ltr">{formatTime(match.kickoffAt)}</bdi>
                          {" · "}
                          {HOME_AWAY_LABEL[match.homeAway]}
                          {match.competition ? ` · ${match.competition}` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )
      )}
    </>
  );
}
