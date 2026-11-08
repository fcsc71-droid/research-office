import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AssignmentStatus } from "@/generated/prisma/enums";
import { ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUS_LABELS, RECOMMENDATION_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Pagination, StatCard } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { cn, formatDate } from "@/lib/utils";
import { Hourglass, CheckCircle2, AlertTriangle } from "lucide-react";

export const metadata = { title: "التحكيم العلمي" };
const PAGE_SIZE = 20;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("reviews.perform", "reviews.assign", "reviews.view_all");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const manager = can(user, "reviews.assign") || can(user, "reviews.view_all");
  // المحكم يرى التكليفات المسندة إليه فقط
  const scope: Prisma.ReviewAssignmentWhereInput = manager && sp.mine !== "1" ? {} : { reviewerId: user.id };
  const where: Prisma.ReviewAssignmentWhereInput = { ...scope };
  if (sp.status && sp.status in AssignmentStatus) where.status = sp.status as AssignmentStatus;
  if (sp.late === "1") Object.assign(where, { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lt: new Date() } });
  if (sp.reviewerId && manager) where.reviewerId = sp.reviewerId;
  if (sp.q) where.paper = { OR: [{ titleAr: { contains: sp.q, mode: "insensitive" } }, { referenceNo: { contains: sp.q, mode: "insensitive" } }] };

  const [total, items, stats, reviewers] = await Promise.all([
    db.reviewAssignment.count({ where }),
    db.reviewAssignment.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        paper: { select: { id: true, titleAr: true, referenceNo: true } },
        reviewer: { select: { name: true } },
        review: { select: { recommendation: true, overallScore: true, isDraft: true } },
      },
    }),
    db.reviewAssignment.groupBy({ by: ["status"], where: scope, _count: true }),
    manager ? db.user.findMany({ where: { role: { key: "REVIEWER" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const lateCount = await db.reviewAssignment.count({ where: { ...scope, status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lt: new Date() } } });
  const sc = (...s: string[]) => stats.filter((x) => s.includes(x.status)).reduce((a, b) => a + b._count, 0);

  return (
    <div className="grid gap-5">
      <PageHeader icon={<ClipboardCheck />} title={manager ? "التحكيم العلمي" : "تكليفات التحكيم الخاصة بي"} description={manager ? "متابعة جميع تكليفات التحكيم ومواعيدها ونتائجها" : "الأبحاث المسندة إليك للتحكيم فقط"} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="بانتظار التحكيم" value={sc("PENDING", "IN_PROGRESS")} icon={<Hourglass />} tone="amber" href="/reviews?status=PENDING" />
        <StatCard label="تم التسليم" value={sc("SUBMITTED")} icon={<CheckCircle2 />} tone="green" href="/reviews?status=SUBMITTED" />
        <StatCard label="متأخرة" value={lateCount} icon={<AlertTriangle />} tone="red" href="/reviews?late=1" />
        <StatCard label="اعتذارات / ملغاة" value={sc("DECLINED", "CANCELLED")} icon={<ClipboardCheck />} tone="slate" />
      </div>
      <Card className="overflow-hidden">
        <FilterBar
          basePath="/reviews"
          fields={[
            { type: "search", name: "q", value: sp.q, placeholder: "ابحث بعنوان البحث أو الرقم المرجعي" },
            { type: "select", name: "status", label: "الحالة", value: sp.status, options: Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
            ...(manager ? [{ type: "select" as const, name: "reviewerId", label: "المحكم", value: sp.reviewerId, options: reviewers.map((r) => ({ value: r.id, label: r.name })) }] : []),
          ]}
        />
        {items.length === 0 ? <EmptyState title="لا توجد تكليفات تحكيم" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البحث</TableHead>
                {manager && <TableHead>المحكم</TableHead>}
                <TableHead>الجولة</TableHead>
                <TableHead>تاريخ التكليف</TableHead>
                <TableHead>موعد التسليم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التوصية</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => {
                const late = ["PENDING", "IN_PROGRESS"].includes(a.status) && a.dueDate < new Date();
                const isMine = a.reviewerId === user.id;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-sm">
                      <p className="font-semibold text-navy">{a.paper.titleAr}</p>
                      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{a.paper.referenceNo}</p>
                    </TableCell>
                    {manager && <TableCell>{a.reviewer.name}</TableCell>}
                    <TableCell>{a.round}</TableCell>
                    <TableCell className="text-xs">{formatDate(a.assignedAt)}</TableCell>
                    <TableCell className={cn("text-xs whitespace-nowrap", late && "font-bold text-destructive")}>{formatDate(a.dueDate)}{late && " (متأخر)"}</TableCell>
                    <TableCell><span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", ASSIGNMENT_STATUS_COLORS[a.status])}>{ASSIGNMENT_STATUS_LABELS[a.status]}</span></TableCell>
                    <TableCell className="text-xs">
                      {a.review && !a.review.isDraft && (isMine || can(user, "reviews.view_all")) ? `${RECOMMENDATION_LABELS[a.review.recommendation]} (${a.review.overallScore.toFixed(1)})` : "—"}
                    </TableCell>
                    <TableCell>
                      {isMine ? (
                        <Button asChild size="sm" variant={["PENDING", "IN_PROGRESS"].includes(a.status) ? "default" : "outline"}>
                          <Link href={`/reviews/${a.id}`}>{["PENDING", "IN_PROGRESS"].includes(a.status) ? "تحكيم" : "عرض"}</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline"><Link href={`/research/${a.paper.id}`}>البحث</Link></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/reviews" params={sp} />
      </Card>
    </div>
  );
}
