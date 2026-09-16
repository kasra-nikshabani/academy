import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getTeam } from "@/lib/services/academy.service";
import { listTeamRoster } from "@/lib/services/enrollment.service";
import { toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "ترکیب تیم" };
export const dynamic = "force-dynamic";

/**
 * A team's squad for the active season.
 *
 * `listTeamRoster` refuses a team outside the caller's scope, so a coach
 * opening another team's id gets the same answer as a team that does not
 * exist.
 */
export default async function TeamRosterPage(props: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireUser();
  const { id } = await props.params;

  const [team, roster] = await Promise.all([
    getTeam(caller, id),
    listTeamRoster(caller, id),
  ]);

  return (
    <>
      <PageHeader
        title={team.name}
        description={`${team.ageGroup.name} · ${team.birthYears?.label ?? "بدون فصل فعال"}`}
        actions={
          <Badge variant="secondary">
            {toPersianDigits(roster.length)} بازیکن
          </Badge>
        }
      />

      <DataTable
        rows={roster}
        rowKey={(row) => row.id}
        empty={{
          icon: Users,
          title: "هنوز بازیکنی در این تیم نیست",
          description: "افزودن بازیکن به تیم توسط مدیر آکادمی انجام می‌شود.",
        }}
        columns={[
          {
            id: "jersey",
            header: "شماره",
            cell: (row) =>
              row.jerseyNumber ? toPersianDigits(row.jerseyNumber) : "—",
          },
          {
            id: "name",
            header: "بازیکن",
            cell: (row) => (
              <span className="font-medium">
                {row.player.person.firstName} {row.player.person.lastName}
              </span>
            ),
          },
          {
            id: "code",
            header: "کد بازیکن",
            hideOnMobile: true,
            cell: (row) => (
              <bdi dir="ltr" className="text-muted-foreground">
                <code>{row.player.playerCode}</code>
              </bdi>
            ),
          },
          {
            id: "birthYear",
            header: "سال تولد",
            hideOnMobile: true,
            cell: (row) =>
              row.player.person.dateOfBirth
                ? toPersianDigits(toJalali(row.player.person.dateOfBirth).jy)
                : "—",
          },
          {
            id: "primary",
            header: "تیم اصلی",
            className: "text-end",
            cell: (row) =>
              row.isPrimary ? (
                <Badge className="bg-brand text-brand-foreground">بله</Badge>
              ) : (
                <Badge variant="outline">خیر</Badge>
              ),
          },
        ]}
      />
    </>
  );
}
