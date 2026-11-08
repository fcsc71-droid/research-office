import { Users, UserPlus, PenLine, Trash2, Power } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { saveUserAction, toggleUserActiveAction, deleteUserAction } from "@/actions/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Pagination } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { UserFields } from "@/components/app/user-fields";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "إدارة المستخدمين" };
const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("users.manage");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.UserWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }];
  if (sp.roleId) where.roleId = sp.roleId;
  if (sp.active) where.isActive = sp.active === "1";
  const [total, users, roles, departments] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { role: true } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ orderBy: { name: "asc" }, include: { college: { select: { name: true } } } }),
  ]);
  const assignableRoles = me.roleKey === "ADMIN" ? roles : roles.filter((r) => r.key !== "ADMIN");

  return (
    <div>
      <PageHeader icon={<Users />} title="إدارة المستخدمين" description="حسابات الدخول وأدوارها"
        actions={
          <FormDialog wide trigger={<Button><UserPlus /> مستخدم جديد</Button>} title="إضافة مستخدم" action={saveUserAction.bind(null, null)}>
            <UserFields roles={assignableRoles} departments={departments} />
          </FormDialog>
        } />
      <Card className="overflow-hidden">
        <FilterBar basePath="/users" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالاسم أو البريد" },
          { type: "select", name: "roleId", label: "الدور", value: sp.roleId, options: roles.map((r) => ({ value: r.id, label: r.name })) },
          { type: "select", name: "active", label: "الحالة", value: sp.active, options: [{ value: "1", label: "مفعّل" }, { value: "0", label: "معطل" }] },
        ]} />
        {users.length === 0 ? <EmptyState title="لا يوجد مستخدمون" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>المستخدم</TableHead><TableHead>الدور</TableHead><TableHead>الحالة</TableHead><TableHead>آخر دخول</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><p className="font-semibold text-navy">{u.name}</p><p className="text-xs text-muted-foreground" dir="ltr">{u.email}</p></TableCell>
                  <TableCell><Badge variant="secondary">{u.role.name}</Badge></TableCell>
                  <TableCell>{u.isActive ? <Badge variant="success">مفعّل</Badge> : <Badge variant="outline">معطل</Badge>}{u.lockedUntil && u.lockedUntil > new Date() && <Badge variant="warning" className="ms-1">مقفل مؤقتاً</Badge>}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(u.lastLoginAt)}</TableCell>
                  <TableCell>
                    {(u.role.key !== "ADMIN" || me.roleKey === "ADMIN") && (
                      <div className="flex gap-1">
                        <FormDialog wide trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل المستخدم" action={saveUserAction.bind(null, u.id)}>
                          <UserFields u={u} roles={assignableRoles} departments={departments} />
                        </FormDialog>
                        {u.id !== me.id && (
                          <>
                            <ConfirmButton action={toggleUserActiveAction.bind(null, u.id)} title={u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"} description={u.isActive ? "لن يتمكن المستخدم من الدخول وسيتم إنهاء جلساته." : "سيتمكن المستخدم من الدخول مجدداً."} confirmVariant="default" variant="ghost" size="icon-sm">
                              <Power className={u.isActive ? "text-amber-600" : "text-emerald-600"} />
                            </ConfirmButton>
                            <ConfirmButton action={deleteUserAction.bind(null, u.id)} title="حذف المستخدم" description="سيتم حذف الحساب نهائياً. إذا كان لديه سجلات مرتبطة يُفضّل تعطيله." confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/users" params={sp} />
      </Card>
    </div>
  );
}
