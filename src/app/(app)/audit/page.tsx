import { History } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Pagination } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "سجل العمليات" };
const PAGE_SIZE = 30;
const ENTITY_LABELS: Record<string, string> = {
  ResearchPaper: "بحث", ResearchFile: "ملف", ResearchComment: "ملاحظة", ReviewAssignment: "تحكيم", Researcher: "باحث", User: "مستخدم",
  Role: "دور", College: "كلية", Department: "قسم", ResearchCategory: "تخصص", SystemSetting: "إعدادات", System: "النظام", Report: "تقرير",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.action) where.action = sp.action;
  if (sp.entity) where.entity = sp.entity;
  if (sp.userId) where.userId = sp.userId;
  if (sp.q) where.summary = { contains: sp.q, mode: "insensitive" };
  if (sp.from || sp.to) where.createdAt = { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}) };
  const [total, logs, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } } } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader icon={<History />} title="سجل العمليات" description="سجل تدقيق لجميع العمليات الإدارية والحساسة في النظام" />
      <Card className="overflow-hidden">
        <FilterBar basePath="/audit" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث في الوصف..." },
          { type: "select", name: "action", label: "العملية", value: sp.action, options: Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "entity", label: "الكيان", value: sp.entity, options: Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "userId", label: "المستخدم", value: sp.userId, options: users.map((u) => ({ value: u.id, label: u.name })) },
          { type: "date", name: "from", label: "من", value: sp.from },
          { type: "date", name: "to", label: "إلى", value: sp.to },
        ]} />
        {logs.length === 0 ? <EmptyState title="لا توجد سجلات" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>المستخدم</TableHead><TableHead>العملية</TableHead><TableHead>الكيان</TableHead><TableHead>الوصف</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(l.createdAt)}</TableCell>
                  <TableCell className="text-sm">{l.user?.name ?? "النظام"}</TableCell>
                  <TableCell><Badge variant={l.action === "DELETE" || l.action === "LOGIN_FAILED" ? "destructive" : "secondary"}>{AUDIT_ACTION_LABELS[l.action] ?? l.action}</Badge></TableCell>
                  <TableCell className="text-xs">{ENTITY_LABELS[l.entity] ?? l.entity}</TableCell>
                  <TableCell className="max-w-md text-sm">{l.summary}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{l.ipAddress ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/audit" params={sp} />
      </Card>
    </div>
  );
}
