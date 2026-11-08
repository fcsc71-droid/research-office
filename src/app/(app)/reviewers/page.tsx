import { UserCheck, UserPlus, PenLine, Power } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUserAction, toggleUserActiveAction } from "@/actions/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { UserFields } from "@/components/app/user-fields";

export const metadata = { title: "إدارة المحكمين" };

export default async function ReviewersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("reviewers.manage");
  const sp = await searchParams;
  const role = await db.role.findUniqueOrThrow({ where: { key: "REVIEWER" } });
  const [reviewers, departments] = await Promise.all([
    db.user.findMany({
      where: {
        roleId: role.id,
        ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { specialization: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        department: { select: { name: true } },
        reviewAssignments: { select: { status: true, dueDate: true, review: { select: { overallScore: true, isDraft: true } } } },
      },
    }),
    db.department.findMany({ orderBy: { name: "asc" }, include: { college: { select: { name: true } } } }),
  ]);

  return (
    <div>
      <PageHeader icon={<UserCheck />} title="إدارة المحكمين" description="المحكمون العلميون وأعباء التحكيم الحالية"
        actions={
          <FormDialog wide trigger={<Button><UserPlus /> إضافة محكم</Button>} title="إضافة محكم علمي" description="سيتم إنشاء حساب دخول بدور محكم علمي" action={saveUserAction.bind(null, null)}>
            <UserFields roles={[]} departments={departments} reviewerMode fixedRoleId={role.id} />
          </FormDialog>
        } />
      <Card className="overflow-hidden">
        <FilterBar basePath="/reviewers" fields={[{ type: "search", name: "q", value: sp.q, placeholder: "ابحث بالاسم أو التخصص" }]} />
        {reviewers.length === 0 ? <EmptyState title="لا يوجد محكمون" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>المحكم</TableHead><TableHead>التخصص</TableHead><TableHead>تكليفات نشطة</TableHead><TableHead>متأخرة</TableHead>
              <TableHead>مكتملة</TableHead><TableHead>متوسط الدرجات</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {reviewers.map((r) => {
                const active = r.reviewAssignments.filter((a) => ["PENDING", "IN_PROGRESS"].includes(a.status));
                const late = active.filter((a) => a.dueDate < new Date()).length;
                const done = r.reviewAssignments.filter((a) => a.status === "SUBMITTED");
                const avg = done.length ? (done.reduce((s, a) => s + (a.review?.overallScore ?? 0), 0) / done.length).toFixed(1) : "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell><p className="font-semibold text-navy">{r.academicTitle ? `${r.academicTitle} — ` : ""}{r.name}</p><p className="text-xs text-muted-foreground" dir="ltr">{r.email}</p></TableCell>
                    <TableCell className="text-xs">{r.specialization ?? "—"}<br /><span className="text-muted-foreground">{r.department?.name ?? r.institution ?? ""}</span></TableCell>
                    <TableCell className="font-bold text-navy">{active.length}</TableCell>
                    <TableCell className={late ? "font-bold text-destructive" : ""}>{late}</TableCell>
                    <TableCell>{done.length}</TableCell>
                    <TableCell>{avg}</TableCell>
                    <TableCell>{r.isActive ? <Badge variant="success">نشط</Badge> : <Badge variant="outline">معطل</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <FormDialog wide trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل بيانات المحكم" action={saveUserAction.bind(null, r.id)}>
                          <UserFields u={r} roles={[]} departments={departments} reviewerMode fixedRoleId={role.id} />
                        </FormDialog>
                        <ConfirmButton action={toggleUserActiveAction.bind(null, r.id)} title={r.isActive ? "تعطيل المحكم" : "تفعيل المحكم"} confirmVariant="default" variant="ghost" size="icon-sm">
                          <Power className={r.isActive ? "text-amber-600" : "text-emerald-600"} />
                        </ConfirmButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
