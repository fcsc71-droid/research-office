import Link from "next/link";
import { FilePlus2, FileText, Users } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { visiblePapersWhere } from "@/lib/access";
import type { Prisma } from "@/generated/prisma/client";
import { ResearchStatus, ResearchType } from "@/generated/prisma/enums";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatusBadge, EmptyState, Pagination } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "إدارة الأبحاث" };
const PAGE_SIZE = 15;

const SORTS: Record<string, { label: string; orderBy: Prisma.ResearchPaperOrderByWithRelationInput }> = {
  newest: { label: "الأحدث", orderBy: { createdAt: "desc" } },
  oldest: { label: "الأقدم", orderBy: { createdAt: "asc" } },
  submitted: { label: "تاريخ التقديم", orderBy: { submittedAt: { sort: "desc", nulls: "last" } } },
  title: { label: "العنوان", orderBy: { titleAr: "asc" } },
  ref: { label: "الرقم المرجعي", orderBy: { referenceNo: "asc" } },
  updated: { label: "آخر تحديث", orderBy: { updatedAt: "desc" } },
};

export default async function ResearchListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("research.view_all", "research.create");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const staff = can(user, "research.view_all");

  const where: Prisma.ResearchPaperWhereInput = { AND: [visiblePapersWhere(user)] };
  const and = where.AND as Prisma.ResearchPaperWhereInput[];
  if (sp.q) {
    const q = sp.q.trim().slice(0, 100);
    and.push({
      OR: [
        { titleAr: { contains: q, mode: "insensitive" } },
        { titleEn: { contains: q, mode: "insensitive" } },
        { referenceNo: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { keywords: { has: q } },
        { mainResearcher: { fullName: { contains: q, mode: "insensitive" } } },
        { supervisorName: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (sp.status && sp.status in ResearchStatus) and.push({ status: sp.status as ResearchStatus });
  if (sp.type && sp.type in ResearchType) and.push({ type: sp.type as ResearchType });
  if (sp.collegeId) and.push({ collegeId: sp.collegeId });
  if (sp.departmentId) and.push({ departmentId: sp.departmentId });
  if (sp.categoryId) and.push({ categoryId: sp.categoryId });
  if (sp.year && /^\d{4}$/.test(sp.year)) {
    and.push({ createdAt: { gte: new Date(`${sp.year}-01-01`), lt: new Date(`${Number(sp.year) + 1}-01-01`) } });
  }
  const sort = SORTS[sp.sort ?? "newest"] ?? SORTS.newest;

  const [total, papers, colleges, departments, categories] = await Promise.all([
    db.researchPaper.count({ where }),
    db.researchPaper.findMany({
      where,
      orderBy: sort.orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        mainResearcher: { select: { fullName: true } },
        department: { select: { name: true } },
        _count: { select: { authors: true, files: { where: { isCurrent: true } } } },
      },
    }),
    staff ? db.college.findMany({ orderBy: { name: "asc" } }) : [],
    staff ? db.department.findMany({ orderBy: { name: "asc" } }) : [],
    db.researchCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  const thisYear = new Date().getFullYear();

  return (
    <div>
      <PageHeader
        icon={<FileText />}
        title={staff ? "إدارة الأبحاث العلمية" : "أبحاثي"}
        description={staff ? "جميع الأبحاث المسجلة في المكتب مع إمكانية البحث والتصفية والترتيب" : "الأبحاث التي قدمتها أو تشارك فيها"}
        actions={can(user, "research.create") && <Button asChild><Link href="/research/new"><FilePlus2 /> إضافة بحث جديد</Link></Button>}
      />
      <Card className="overflow-hidden">
        <FilterBar
          basePath="/research"
          fields={[
            { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالعنوان، الرقم المرجعي، الباحث، الكلمات المفتاحية..." },
            { type: "select", name: "status", label: "الحالة", value: sp.status, options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) },
            { type: "select", name: "type", label: "النوع", value: sp.type, options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
            ...(staff
              ? [
                  { type: "select" as const, name: "collegeId", label: "الكلية", value: sp.collegeId, options: colleges.map((c) => ({ value: c.id, label: c.name })) },
                  { type: "select" as const, name: "departmentId", label: "القسم", value: sp.departmentId, options: departments.map((c) => ({ value: c.id, label: c.name })) },
                ]
              : []),
            { type: "select", name: "categoryId", label: "التخصص", value: sp.categoryId, options: categories.map((c) => ({ value: c.id, label: c.name })) },
            { type: "select", name: "year", label: "السنة", value: sp.year, options: Array.from({ length: 8 }, (_, i) => ({ value: String(thisYear - i), label: String(thisYear - i) })) },
            { type: "select", name: "sort", label: "الترتيب", value: sp.sort, options: Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label })) },
          ]}
        />
        {papers.length === 0 ? (
          <EmptyState title="لا توجد أبحاث مطابقة" description="جرّب تعديل معايير البحث أو أضف بحثاً جديداً" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم المرجعي</TableHead>
                <TableHead>عنوان البحث</TableHead>
                <TableHead>الباحث الرئيسي</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>تاريخ التقديم</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {papers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs" dir="ltr">{p.referenceNo}</TableCell>
                  <TableCell className="max-w-md">
                    <Link href={`/research/${p.id}`} className="font-semibold text-navy hover:text-brand hover:underline">{p.titleAr}</Link>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Users className="size-3" /> {p._count.authors} باحث · {p._count.files} ملف
                    </p>
                  </TableCell>
                  <TableCell>{p.mainResearcher.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{TYPE_LABELS[p.type]}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(p.submittedAt)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/research" params={sp} />
      </Card>
    </div>
  );
}
