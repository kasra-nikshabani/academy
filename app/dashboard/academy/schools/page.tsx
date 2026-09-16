import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { listSchools } from "@/lib/services/academy.service";

export const metadata: Metadata = { title: "مدارس ورزشی" };
export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  const caller = await requireUser();
  const schools = await listSchools(caller, undefined, true);

  return (
    <>
      <PageHeader
        title="مدارس ورزشی"
        description="مدرسه، مسیر ورود پایه بازیکنان به آکادمی است."
      />

      <DataTable
        rows={schools}
        rowKey={(school) => school.id}
        empty={{
          icon: GraduationCap,
          title: "هنوز مدرسه‌ای ثبت نشده است",
          description:
            "برای هر رشته ورزشی می‌توانید یک یا چند مدرسه تعریف کنید.",
        }}
        columns={[
          {
            id: "name",
            header: "نام",
            cell: (school) => (
              <span className="font-medium">{school.name}</span>
            ),
          },
          {
            id: "sport",
            header: "رشته",
            cell: (school) => school.sport.name,
          },
          {
            id: "city",
            header: "شهر",
            hideOnMobile: true,
            cell: (school) => school.city ?? "—",
          },
          {
            id: "status",
            header: "وضعیت",
            className: "text-end",
            cell: (school) =>
              school.isActive ? (
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
