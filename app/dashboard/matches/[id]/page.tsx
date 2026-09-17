import type { Metadata } from "next";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/states/empty-state";
import { MatchSheet } from "@/components/matches/match-sheet";
import {
  HOME_AWAY_LABEL,
  MATCH_STATUS_CLASS,
  MATCH_STATUS_LABEL,
  OUTCOME_CLASS,
  OUTCOME_LABEL,
} from "@/components/matches/match-meta";
import { requireUser } from "@/lib/auth";
import { canEditMatch, getMatch } from "@/lib/services/match.service";
import { matchOutcome } from "@/lib/services/match-result";
import { listTeamRoster } from "@/lib/services/enrollment.service";
import { formatJalaliLong, formatTimeRange } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "مسابقه" };
export const dynamic = "force-dynamic";

export default async function MatchPage(props: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireUser();
  const { id } = await props.params;

  const match = await getMatch(caller, id);
  const outcome = matchOutcome(match);

  /*
    The squad is only fetched for someone who can edit the sheet. A parent
    reading the fixture has no business receiving the whole team list, which
    is the same line the attendance register draws.
  */
  const editable = canEditMatch(caller);
  const squad = editable
    ? await listTeamRoster(caller, match.teamId).catch(() => [])
    : [];

  const statsOpen = match.kickoffAt <= new Date();

  return (
    <>
      <PageHeader
        title={`${match.team.name} − ${match.opponent}`}
        description={formatJalaliLong(match.kickoffAt)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {outcome ? (
              <Badge className={cn(OUTCOME_CLASS[outcome], "tabular-nums")}>
                {OUTCOME_LABEL[outcome]}{" "}
                <bdi dir="ltr">
                  {toPersianDigits(match.goalsFor ?? 0)}–
                  {toPersianDigits(match.goalsAgainst ?? 0)}
                </bdi>
              </Badge>
            ) : null}
            <Badge className={cn(MATCH_STATUS_CLASS[match.status])}>
              {MATCH_STATUS_LABEL[match.status]}
            </Badge>
          </div>
        }
      />

      {match.status === "CANCELLED" || match.status === "POSTPONED" ? (
        <Alert>
          <AlertTitle>
            {match.status === "CANCELLED"
              ? "این مسابقه لغو شده است"
              : "این مسابقه به تعویق افتاده است"}
          </AlertTitle>
          <AlertDescription>
            {match.cancelReason ?? "دلیلی ثبت نشده است."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>مشخصات مسابقه</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CalendarDays
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">زمان</dt>
                  <dd>
                    <bdi>{formatTimeRange(match.kickoffAt, match.endsAt)}</bdi>
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">محل</dt>
                  <dd>
                    {HOME_AWAY_LABEL[match.homeAway]}
                    {match.venue ? ` — ${match.venue}` : ""}
                  </dd>
                </div>
              </div>

              {match.competition ? (
                <div className="flex items-start gap-2">
                  <Trophy
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="text-muted-foreground">رقابت</dt>
                    <dd>{match.competition}</dd>
                  </div>
                </div>
              ) : null}

              <div className="border-t border-border pt-3">
                <dt className="text-muted-foreground">رده سنی</dt>
                <dd>
                  {match.team.ageGroup.name} ({match.team.ageGroup.code})
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">فصل</dt>
                <dd>{match.season.name}</dd>
              </div>
            </dl>

            {match.notes ? (
              <p className="mt-4 border-t border-border pt-3 text-sm leading-7 whitespace-pre-line">
                {match.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ترکیب و آمار</CardTitle>
          </CardHeader>
          <CardContent>
            {editable ? (
              squad.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="ترکیب این تیم در این فصل خالی است"
                  description="ترکیب مسابقه فقط از بازیکنان همان تیم در همان فصل بسته می‌شود."
                />
              ) : (
                <MatchSheet
                  matchId={match.id}
                  squad={squad.map((membership) => ({
                    playerId: membership.playerId,
                    firstName: membership.player.person.firstName,
                    lastName: membership.player.person.lastName,
                    jerseyNumber: membership.jerseyNumber,
                  }))}
                  rows={match.lineup.map((entry) => {
                    const stat = match.stats.find(
                      (item) => item.playerId === entry.playerId,
                    );
                    return {
                      playerId: entry.playerId,
                      role: entry.role,
                      shirtNumber: entry.shirtNumber,
                      minutesPlayed: stat?.minutesPlayed ?? 0,
                      goals: stat?.goals ?? 0,
                      assists: stat?.assists ?? 0,
                      yellowCards: stat?.yellowCards ?? 0,
                      redCards: stat?.redCards ?? 0,
                    };
                  })}
                  editable={match.status !== "CANCELLED"}
                  statsOpen={statsOpen}
                />
              )
            ) : match.lineup.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="ترکیب هنوز اعلام نشده است"
                description="ترکیب مسابقه را کادر فنی پیش از بازی مشخص می‌کند."
              />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {match.lineup.map((entry) => {
                  const stat = match.stats.find(
                    (item) => item.playerId === entry.playerId,
                  );

                  return (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span>
                        {entry.shirtNumber ? (
                          <span className="me-2 text-muted-foreground tabular-nums">
                            {toPersianDigits(entry.shirtNumber)}
                          </span>
                        ) : null}
                        {entry.player.person.firstName}{" "}
                        {entry.player.person.lastName}
                      </span>

                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {entry.role === "STARTER" ? "اصلی" : "ذخیره"}
                        </Badge>
                        {stat && stat.minutesPlayed > 0 ? (
                          <span className="tabular-nums">
                            {toPersianDigits(stat.minutesPlayed)}′
                            {stat.goals > 0
                              ? ` · ${toPersianDigits(stat.goals)} گل`
                              : ""}
                            {stat.assists > 0
                              ? ` · ${toPersianDigits(stat.assists)} پاس گل`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
