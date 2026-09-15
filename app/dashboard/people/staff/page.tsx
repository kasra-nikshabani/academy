import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listStaff } from "@/lib/services/people.service";
import { toPersianDigits } from "@/lib/utils/number";

export const metadata: Metadata = { title: "کادر فنی" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const caller = await requireUser();
  const { items, meta } = await listStaff(caller, { page: 1, pageSize: 20 });

  return (
    <>
      <PageHeader
        title="کادر فنی"
        description={`${toPersianDigits(meta.total)} نفر در دسترس شما است.`}
      />

      <DataTable
        rows={items}
        rowKey={(staff) => staff.id}
        empty={{
          icon: UserCog,
          title: "عضوی از کادر فنی در دسترس شما نیست",
          description: "فقط کادر تیم‌های تحت مسئولیت شما نمایش داده می‌شود.",
        }}
        columns={[
          {
            id: "name",
            header: "نام",
            cell: (staff) => (
              <span className="font-medium">
                {staff.person.firstName} {staff.person.lastName}
              </span>
            ),
          },
          {
            id: "title",
            header: "سمت",
            cell: (staff) => staff.title ?? "—",
          },
          {
            id: "teams",
            header: "تیم‌ها",
            cell: (staff) =>
              staff.teams.length === 0 ? (
                <span className="text-muted-foreground">بدون تیم</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {staff.teams.map((assignment) => (
                    <Badge key={assignment.id} variant="outline">
                      {assignment.team.name}
                    </Badge>
                  ))}
                </div>
              ),
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (staff) =>
              staff.status === "ACTIVE" ? (
                <Badge variant="secondary">فعال</Badge>
              ) : (
                <Badge variant="outline">غیرفعال</Badge>
              ),
          },
        ]}
      />
    </>
  );
}
