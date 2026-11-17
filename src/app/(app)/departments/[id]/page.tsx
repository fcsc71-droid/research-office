import Link from "next/link";
import { notFound } from "next/navigation";
import { Building, Users, FileText, FolderKanban, Presentation, Award, CheckCircle2, Tags } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { departmentStats } from "@/lib/department-stats";
import { DEGREE_LABELS, EVENT_TYPE_LABELS, INDEXING_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/app/misc";
import { HorizontalBars } from "@/components/app/charts";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "الملف البحثي للقسم" };

export default async function DepartmentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("departments.profile");
  const { id } = await params;
  if (!can(user, "research.view_all") && user.departmentId !== id) notFound();
  const dept = await db.department.findUnique({ where: { id }, include: { college: true } });
  if (!dept) notFound();
  const s = await departmentStats(id);
  return (
    <div className="grid gap-5">
      <PageHeader icon={<Building />} title={`الملف البحثي — ${dept.name}`} description={dept.college.name} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="أعضاء هيئة التدريس والباحثون" value={s.faculty.length} icon={<Users />} />
        <StatCard label="البحوث المنشورة" value={s.papers.length} icon={<FileText />} tone="blue" />
        <StatCard label="Scopus / WoS" value={s.indexed} icon={<CheckCircle2 />} tone="green" />
        <StatCard label="المشاريع البحثية" value={s.projects.length} icon={<FolderKanban />} tone="indigo" />
        <StatCard label="المؤتمرات والأنشطة" value={s.events.length} icon={<Presentation />} tone="amber" />
        <StatCard label="الجوائز" value={s.awards} icon={<Award />} tone="teal" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>البحوث حسب السنوات</CardTitle></CardHeader>
          <CardContent><HorizontalBars data={s.byYear} name="بحث منشور" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Tags className="size-4 text-brand" /> أبرز الاهتمامات البحثية والتخصصات</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">{s.topInterests.length ? s.topInterests.map(([k, n]) => <Badge key={k} variant="secondary">{k} ({n})</Badge>) : <span className="text-sm text-muted-foreground">لم تُسجَّل اهتمامات بحثية</span>}</div>
            <div><p className="mb-1 text-sm font-bold text-muted-foreground">التخصصات العلمية</p><div className="flex flex-wrap gap-1.5">{s.specializations.map((x) => <Badge key={x} variant="outline">{x}</Badge>)}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>أعضاء هيئة التدريس</CardTitle></CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {s.faculty.map((f) => (
              <Link key={f.id} href={`/researchers/${f.id}`} className="flex justify-between rounded-md border px-3 py-2 hover:bg-accent/40">
                <span className="font-semibold">{f.fullName}</span><span className="text-xs text-muted-foreground">{DEGREE_LABELS[f.academicDegree]}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>أحدث البحوث المنشورة</CardTitle></CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {s.papers.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/research/${p.id}`} className="rounded-md border px-3 py-2 hover:bg-accent/40">
                <span className="font-semibold">{p.titleAr}</span>
                <span className="block text-xs text-muted-foreground">{p.publicationYear ?? formatDate(p.publishedAt)} · {INDEXING_LABELS[p.indexing]}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>المشاريع البحثية</CardTitle></CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {s.projects.length === 0 && <p className="text-muted-foreground">لا توجد مشاريع معتمدة</p>}
            {s.projects.map((p) => <Link key={p.id} href={`/projects/${p.id}`} className="flex justify-between rounded-md border px-3 py-2 hover:bg-accent/40"><span>{p.title}</span><span className="text-xs text-muted-foreground">{PROJECT_STATUS_LABELS[p.status]}</span></Link>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>المؤتمرات والأنشطة</CardTitle></CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {s.events.length === 0 && <p className="text-muted-foreground">لا توجد مشاركات معتمدة</p>}
            {s.events.slice(0, 10).map((e) => <div key={e.id} className="flex justify-between rounded-md border px-3 py-2"><span>{e.name}</span><span className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[e.type]} · {formatDate(e.startDate)}</span></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
