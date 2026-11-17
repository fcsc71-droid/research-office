import Link from "next/link";
import { redirect } from "next/navigation";
import { Building, Users, FileText, FolderKanban } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/app/misc";

export const metadata = { title: "الملفات البحثية للأقسام" };

export default async function DepartmentsPage() {
  const user = await requirePermission("departments.profile");
  // رئيس القسم يُوجَّه إلى ملف قسمه مباشرة
  if (!can(user, "research.view_all") && user.departmentId) redirect(`/departments/${user.departmentId}`);
  const depts = await db.department.findMany({
    orderBy: [{ college: { name: "asc" } }, { name: "asc" }],
    include: {
      college: { select: { name: true } },
      _count: { select: { researchers: true, projects: { where: { approval: "APPROVED" } }, papers: { where: { status: "PUBLISHED" } } } },
    },
  });
  return (
    <div>
      <PageHeader icon={<Building />} title="الملفات البحثية للأقسام" description="ملف بحثي إلكتروني مستقل لكل قسم علمي" />
      {depts.length === 0 ? <Card><EmptyState title="لا توجد أقسام" /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {depts.map((d) => (
            <Link key={d.id} href={`/departments/${d.id}`}>
              <Card className="h-full transition hover:shadow-md">
                <CardContent className="grid gap-3 pt-5">
                  <div><p className="text-lg font-extrabold text-navy">{d.name}</p><p className="text-xs text-muted-foreground">{d.college.name}</p></div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-muted/60 p-2"><Users className="mx-auto size-4 text-brand" /><b className="block text-base text-navy">{d._count.researchers}</b>باحث</div>
                    <div className="rounded-lg bg-muted/60 p-2"><FileText className="mx-auto size-4 text-brand" /><b className="block text-base text-navy">{d._count.papers}</b>بحث منشور</div>
                    <div className="rounded-lg bg-muted/60 p-2"><FolderKanban className="mx-auto size-4 text-brand" /><b className="block text-base text-navy">{d._count.projects}</b>مشروع</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
