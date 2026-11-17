import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projectsWhere } from "@/lib/records-access";
import { saveProjectAction } from "@/actions/records";
import type { Prisma } from "@/generated/prisma/client";
import { ProjectStatus, RecordStatus } from "@/generated/prisma/enums";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, RECORD_STATUS_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, StatCard } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ProjectFields } from "@/components/app/project-fields";
import { RecordStatusBadge } from "@/components/app/record-ui";
import { cn, formatDate } from "@/lib/utils";
import { Lightbulb, Hourglass, CheckCircle2, BookOpen } from "lucide-react";

export const metadata = { title: "المشاريع البحثية" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (!(can(user, "projects.manage") || can(user, "records.approve") || can(user, "records.submit_own") || can(user, "research.view_department"))) redirect("/forbidden");
  const sp = await searchParams;
  const and: Prisma.ResearchProjectWhereInput[] = [projectsWhere(user)];
  if (sp.q) and.push({ OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { lead: { fullName: { contains: sp.q, mode: "insensitive" } } }] });
  if (sp.status && sp.status in ProjectStatus) and.push({ status: sp.status as ProjectStatus });
  if (sp.approval && sp.approval in RecordStatus) and.push({ approval: sp.approval as RecordStatus });
  if (sp.departmentId) and.push({ departmentId: sp.departmentId });
  const where = { AND: and };
  const [projects, departments, counts] = await Promise.all([
    db.researchProject.findMany({
      where, orderBy: { createdAt: "desc" },
      include: { lead: { select: { fullName: true } }, department: { select: { name: true } }, _count: { select: { members: true, reports: true } } },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.researchProject.groupBy({ by: ["status"], where: { AND: [projectsWhere(user), { approval: "APPROVED" }] }, _count: true }),
  ]);
  const c = (...s: string[]) => counts.filter((x) => s.includes(x.status)).reduce((a, b) => a + b._count, 0);
  const canAdd = can(user, "projects.manage") || (can(user, "records.submit_own") && !!user.researcherId);

  return (
    <div className="grid gap-5">
      <PageHeader icon={<FolderKanban />} title="المشاريع البحثية" description="متابعة المشاريع في جميع مراحلها: من المقترح حتى نشر النتائج"
        actions={canAdd && (
          <FormDialog wide trigger={<Button><Plus /> مشروع جديد</Button>} title="إضافة مشروع بحثي" action={saveProjectAction.bind(null, null)}>
            <ProjectFields manager={can(user, "projects.manage")} />
          </FormDialog>
        )} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="مقترحات وقيد المراجعة" value={c("PROPOSAL", "UNDER_REVIEW")} icon={<Lightbulb />} tone="slate" />
        <StatCard label="معتمدة وقيد التنفيذ" value={c("APPROVED", "IN_PROGRESS")} icon={<Hourglass />} tone="blue" />
        <StatCard label="مكتملة" value={c("COMPLETED")} icon={<CheckCircle2 />} tone="green" />
        <StatCard label="نُشرت نتائجها" value={c("PUBLISHED")} icon={<BookOpen />} tone="teal" />
      </div>
      <Card className="overflow-hidden">
        <FilterBar basePath="/projects" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بعنوان المشروع أو الباحث" },
          { type: "select", name: "status", label: "المرحلة", value: sp.status, options: Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "approval", label: "الاعتماد", value: sp.approval, options: Object.entries(RECORD_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "departmentId", label: "القسم", value: sp.departmentId, options: departments.map((d) => ({ value: d.id, label: d.name })) },
        ]} />
        {projects.length === 0 ? <EmptyState title="لا توجد مشاريع بحثية" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>المشروع</TableHead><TableHead>الباحث الرئيسي</TableHead><TableHead>القسم</TableHead><TableHead>الفترة</TableHead><TableHead>المرحلة</TableHead><TableHead>الاعتماد</TableHead></TableRow></TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-sm">
                    <Link href={`/projects/${p.id}`} className="font-semibold text-navy hover:text-brand hover:underline">{p.title}</Link>
                    <p className="text-[11px] text-muted-foreground">{p._count.members + 1} باحث · {p._count.reports} تقرير إنجاز</p>
                  </TableCell>
                  <TableCell>{p.lead.fullName}</TableCell>
                  <TableCell className="text-xs">{p.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(p.startDate)}<br />{formatDate(p.expectedEndDate)}</TableCell>
                  <TableCell><span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", PROJECT_STATUS_COLORS[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span></TableCell>
                  <TableCell><RecordStatusBadge status={p.approval} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
