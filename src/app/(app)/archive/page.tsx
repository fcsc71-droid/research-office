import Link from "next/link";
import { Archive, FileDown, CalendarDays } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ResearchType } from "@/generated/prisma/enums";
import { TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, Pagination, StatusBadge } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "الأرشيف العلمي" };
const PAGE_SIZE = 12;

export default async function ArchivePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("archive.view");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const staff = can(user, "research.view_all");
  // الوصول حسب الصلاحيات: غير الموظفين يرون الأبحاث المنشورة فقط
  const base: Prisma.ResearchPaperWhereInput = staff
    ? { status: { in: ["ACCEPTED", "PUBLISHED", "ARCHIVED"] } }
    : { OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED", publishedAt: { not: null } }] };
  const and: Prisma.ResearchPaperWhereInput[] = [base];
  if (sp.q) {
    const q = sp.q.trim().slice(0, 100);
    and.push({ OR: [
      { titleAr: { contains: q, mode: "insensitive" } }, { titleEn: { contains: q, mode: "insensitive" } },
      { abstract: { contains: q, mode: "insensitive" } }, { referenceNo: { contains: q, mode: "insensitive" } },
      { mainResearcher: { fullName: { contains: q, mode: "insensitive" } } }, { keywords: { has: q } },
    ] });
  }
  if (sp.keyword) and.push({ keywords: { has: sp.keyword } });
  if (sp.collegeId) and.push({ collegeId: sp.collegeId });
  if (sp.departmentId) and.push({ departmentId: sp.departmentId });
  if (sp.categoryId) and.push({ categoryId: sp.categoryId });
  if (sp.type && sp.type in ResearchType) and.push({ type: sp.type as ResearchType });
  if (sp.pub === "published") and.push({ publishedAt: { not: null } });
  if (sp.pub === "unpublished") and.push({ publishedAt: null });
  if (sp.year && /^\d{4}$/.test(sp.year)) {
    const y = Number(sp.year);
    and.push({ OR: [
      { submittedAt: { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) } },
      { submittedAt: null, createdAt: { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) } },
    ] });
  }
  const where = { AND: and };

  const [total, papers, colleges, departments, categories, allForYears] = await Promise.all([
    db.researchPaper.count({ where }),
    db.researchPaper.findMany({
      where, orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { submittedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { mainResearcher: { select: { fullName: true } }, department: { select: { name: true } }, college: { select: { name: true } }, category: { select: { name: true } } },
    }),
    db.college.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.researchCategory.findMany({ orderBy: { name: "asc" } }),
    db.researchPaper.findMany({ where: base, select: { submittedAt: true, createdAt: true } }),
  ]);
  const yearCounts = new Map<number, number>();
  for (const p of allForYears) {
    const y = (p.submittedAt ?? p.createdAt).getFullYear();
    yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
  }
  const years = [...yearCounts.entries()].sort((a, b) => b[0] - a[0]);
  const qs = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) q.set(k, v);
    return `/archive?${q}`;
  };

  return (
    <div>
      <PageHeader icon={<Archive />} title="الأرشيف العلمي" description={staff ? "الأبحاث المقبولة والمنشورة والمؤرشفة مصنفة حسب السنة والقسم والتخصص" : "الأبحاث المنشورة المتاحة للاطلاع"} />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-brand" /> حسب السنة</CardTitle></CardHeader>
          <CardContent className="grid gap-1">
            <Link href={qs({ year: undefined })} className={cn("flex justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent", !sp.year && "bg-accent font-bold")}>جميع السنوات <span>{allForYears.length}</span></Link>
            {years.map(([y, c]) => (
              <Link key={y} href={qs({ year: String(y) })} className={cn("flex justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent", sp.year === String(y) && "bg-accent font-bold")}>{y} <span className="text-muted-foreground">{c}</span></Link>
            ))}
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card className="overflow-hidden">
            <FilterBar basePath="/archive" hidden={{ year: sp.year, keyword: sp.keyword }} fields={[
              { type: "search", name: "q", value: sp.q, placeholder: "ابحث داخل بيانات الأبحاث: العنوان، الملخص، الباحث، الكلمات المفتاحية..." },
              { type: "select", name: "collegeId", label: "الكلية", value: sp.collegeId, options: colleges.map((c) => ({ value: c.id, label: c.name })) },
              { type: "select", name: "departmentId", label: "القسم", value: sp.departmentId, options: departments.map((c) => ({ value: c.id, label: c.name })) },
              { type: "select", name: "categoryId", label: "التخصص", value: sp.categoryId, options: categories.map((c) => ({ value: c.id, label: c.name })) },
              { type: "select", name: "type", label: "نوع البحث", value: sp.type, options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              ...(staff ? [{ type: "select" as const, name: "pub", label: "حالة النشر", value: sp.pub, options: [{ value: "published", label: "منشور" }, { value: "unpublished", label: "غير منشور" }] }] : []),
            ]} />
            {sp.keyword && (
              <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">الكلمة المفتاحية: <Badge>#{sp.keyword}</Badge> <Link href={qs({ keyword: undefined })} className="text-xs text-brand">إزالة</Link></div>
            )}
          </Card>
          {papers.length === 0 ? <Card><EmptyState title="لا توجد أبحاث في الأرشيف مطابقة للبحث" /></Card> : (
            <div className="grid gap-3 md:grid-cols-2">
              {papers.map((p) => (
                <Card key={p.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-2 pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">{p.referenceNo}</span>
                      <StatusBadge status={p.status} />
                      <Badge variant="outline">{TYPE_LABELS[p.type]}</Badge>
                    </div>
                    <Link href={`/research/${p.id}`} className="leading-relaxed font-bold text-navy hover:text-brand">{p.titleAr}</Link>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{p.abstract}</p>
                    <p className="text-xs text-muted-foreground">{p.mainResearcher.fullName} · {p.department?.name ?? p.college?.name ?? "—"} · {p.category?.name ?? ""}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.keywords.slice(0, 5).map((k) => <Link key={k} href={qs({ keyword: k })}><Badge variant="secondary">#{k}</Badge></Link>)}
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                      <span>{p.publishedAt ? `نُشر ${formatDate(p.publishedAt)}` : `قُدّم ${formatDate(p.submittedAt)}`}</span>
                      <Button asChild variant="ghost" size="sm"><a href={`/api/research/${p.id}/pdf`}><FileDown /> PDF</a></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Card><Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/archive" params={sp} /></Card>
        </div>
      </div>
    </div>
  );
}
