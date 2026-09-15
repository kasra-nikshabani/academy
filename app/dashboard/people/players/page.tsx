import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listPlayers } from "@/lib/services/people.service";
import { parsePagination } from "@/lib/api";
import { formatJalaliNumeric, toJalali } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "بازیکنان" };
export const dynamic = "force-dynamic";

const STATUS: Record<
  string,
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  ACTIVE: { label: "فعال", variant: "secondary" },
  INACTIVE: { label: "غیرفعال", variant: "outline" },
  INJURED: { label: "مصدوم", variant: "destructive" },
  TRANSFERRED: { label: "منتقل‌شده", variant: "outline" },
  RETIRED: { label: "بازنشسته", variant: "outline" },
};

export default async function PlayersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const caller = await requireUser();
  const searchParams = await props.searchParams;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  const { items, meta } = await listPlayers(caller, parsePagination(params), {
    search: params.get("search") ?? undefined,
  });

  return (
    <>
      <PageHeader
        title="بازیکنان"
        description={`${toPersianDigits(meta.total)} بازیکن در دسترس شما است.`}
      />

      <DataTable
        rows={items}
        rowKey={(player) => player.id}
        empty={{
          icon: Users,
          title: "بازیکنی در دسترس شما نیست",
          description:
            "بسته به نقش شما، فقط بازیکنان تیم‌ها یا فرزندان خودتان نمایش داده می‌شوند.",
        }}
        columns={[
          {
            id: "name",
            header: "نام",
            cell: (player) => (
              <Link
                href={`/dashboard/people/players/${player.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {player.person.firstName} {player.person.lastName}
              </Link>
            ),
          },
          {
            id: "code",
            header: "کد بازیکن",
            hideOnMobile: true,
            cell: (player) => (
              <bdi dir="ltr" className="text-muted-foreground">
                <code>{player.playerCode}</code>
              </bdi>
            ),
          },
          {
            id: "birth",
            header: "تاریخ تولد",
            hideOnMobile: true,
            cell: (player) =>
              player.person.dateOfBirth
                ? formatJalaliNumeric(player.person.dateOfBirth)
                : "—",
          },
          {
            id: "birthYear",
            header: "سال تولد",
            cell: (player) =>
              player.person.dateOfBirth
                ? toPersianDigits(toJalali(player.person.dateOfBirth).jy)
                : "—",
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (player) => {
              const status = STATUS[player.status] ?? STATUS["ACTIVE"]!;
              return <Badge variant={status.variant}>{status.label}</Badge>;
            },
          },
        ]}
      />
    </>
  );
}
