import Link from "next/link";
import { GraduationCap, UserPlus } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AcademicDegree, ResearcherType } from "@/generated/prisma/enums";
import { DEGREE_LABELS, RESEARCHER_TYPE_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Pagination } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";

export const metadata = { title: "الباحثون والطلاب" };
const PAGE_SIZE = 20;

export default async function ResearchersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("researchers.view");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.ResearcherWhereInput = {};
  if (sp.q) where.OR = [
    { fullName: { contains: sp.q, mode: "insensitive" } },
    { universityId: { contains: sp.q } },
    { email: { contains: sp.q, mode: "insensitive" } },
    { specialization: { contains: sp.q, mode: "insensitive" } },
  ];
  if (sp.collegeId) where.collegeId = sp.collegeId;
  if (sp.departmentId) where.departmentId = sp.departmentId;
  if (sp.type && sp.type in ResearcherType) where.type = sp.type as ResearcherType;
  if (sp.degree && sp.degree in AcademicDegree) where.academicDegree = sp.degree as AcademicDegree;

  const [total, items, colleges, departments] = await Promise.all([
    db.researcher.count({ where }),
    db.researcher.findMany({
      where, orderBy: sp.sort === "papers" ? { mainPapers: { _count: "desc" } } : { fullName: "asc" },
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { department: { select: { name: true } }, college: { select: { name: true } }, _count: { select: { mainPapers: true, authorships: true } } },
    }),
    db.college.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader icon={<GraduationCap />} title="الباحثون والطلاب" description="ملفات الباحثين وسجل مشاركاتهم البحثية"
        actions={can(user, "researchers.manage") && <Button asChild><Link href="/researchers/new"><UserPlus /> إضافة باحث</Link></Button>} />
      <Card className="overflow-hidden">
        <FilterBar basePath="/researchers" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالاسم، الرقم الجامعي، البريد، التخصص..." },
          { type: "select", name: "collegeId", label: "الكلية", value: sp.collegeId, options: colleges.map((c) => ({ value: c.id, label: c.name })) },
          { type: "select", name: "departmentId", label: "القسم", value: sp.departmentId, options: departments.map((c) => ({ value: c.id, label: c.name })) },
          { type: "select", name: "type", label: "الفئة", value: sp.type, options: Object.entries(RESEARCHER_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "degree", label: "الدرجة العلمية", value: sp.degree, options: Object.entries(DEGREE_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "sort", label: "الترتيب", value: sp.sort, options: [{ value: "name", label: "الاسم" }, { value: "papers", label: "عدد الأبحاث" }] },
        ]} />
        {items.length === 0 ? <EmptyState title="لا يوجد باحثون مطابقون" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>الاسم</TableHead><TableHead>الرقم الجامعي/الوظيفي</TableHead><TableHead>الكلية / القسم</TableHead>
              <TableHead>الدرجة العلمية</TableHead><TableHead>الأبحاث</TableHead><TableHead>المشاركات</TableHead><TableHead>الحساب</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/researchers/${r.id}`} className="font-semibold text-navy hover:text-brand hover:underline">{r.fullName}</Link>
                    <p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.universityId}</TableCell>
                  <TableCell className="text-xs">{r.college?.name ?? "—"}<br /><span className="text-muted-foreground">{r.department?.name ?? ""}</span></TableCell>
                  <TableCell className="text-xs">{DEGREE_LABELS[r.academicDegree]}<br /><span className="text-muted-foreground">{RESEARCHER_TYPE_LABELS[r.type]}</span></TableCell>
                  <TableCell className="font-bold text-navy">{r._count.mainPapers}</TableCell>
                  <TableCell>{Math.max(0, r._count.authorships - r._count.mainPapers)}</TableCell>
                  <TableCell>{r.userId ? <Badge variant="success">مفعّل</Badge> : <Badge variant="outline">بدون حساب</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/researchers" params={sp} />
      </Card>
    </div>
  );
}
