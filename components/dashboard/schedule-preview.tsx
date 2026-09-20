import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HOME_AWAY_LABEL } from "@/components/matches/match-meta";
import { formatJalali, formatTimeRange, formatTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import type { HomeAway } from "@/lib/generated/prisma/enums";

export interface SessionPreview {
  id: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  team: { id: string; name: string };
}

export interface MatchPreview {
  id: string;
  opponent: string;
  kickoffAt: Date;
  homeAway: HomeAway;
  competition: string | null;
  team: { id: string; name: string };
}

/**
 * What is next.
 *
 * The one thing a coach, a player and a parent all open a dashboard for. Both
 * lists are short on purpose — this is a preview that answers "is there
 * anything today", and the full calendar is one link away.
 */
export function SchedulePreview({
  sessions,
  matches,
}: {
  sessions: readonly SessionPreview[];
  matches: readonly MatchPreview[];
}) {
  if (sessions.length === 0 && matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        برنامه‌ای برای روزهای پیش‌رو ثبت نشده است.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">تمرین</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/dashboard/training/sessions/${session.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{session.team.name}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {toPersianDigits(formatJalali(session.startsAt))}
                      {" · "}
                      {toPersianDigits(
                        formatTimeRange(session.startsAt, session.endsAt),
                      )}
                    </span>
                  </span>
                  {session.location ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {session.location}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">مسابقه</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/dashboard/matches/${match.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{match.opponent}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {match.team.name}
                      {" · "}
                      {toPersianDigits(formatJalali(match.kickoffAt))}
                      {" · "}
                      {toPersianDigits(formatTime(match.kickoffAt))}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {HOME_AWAY_LABEL[match.homeAway]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
