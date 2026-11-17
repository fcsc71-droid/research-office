import { Presentation, Plus, PenLine, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventsWhere } from "@/lib/records-access";
import { attachmentsFor } from "@/lib/attachments";
import { saveEventAction, deleteEventAction, decideRecordAction } from "@/actions/records";
import type { Prisma } from "@/generated/prisma/client";
import { EventType, EventScope, RecordStatus } from "@/generated/prisma/enums";
import { EVENT_SCOPE_LABELS, EVENT_TYPE_LABELS, PARTICIPATION_ROLE_LABELS, RECORD_STATUS_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { EventFields } from "@/components/app/event-fields";
import { AttachmentList } from "@/components/app/attachment-list";
import { ApprovalButton, ApprovalNote, RecordStatusBadge } from "@/components/app/record-ui";
import { formatDate } from "@/lib/utils";

/** صفحة مشتركة: مشاركات أعضاء هيئة التدريس (institute=false) أو الأنشطة التي ينظمها المعهد (institute=true) */
export async function EventsPage({ institute, sp }: { institute: boolean; sp: Record<string, string | undefined> }) {
  const user = await requireUser();
  const manager = can(user, "events.manage");
  if (!institute && !(manager || can(user, "records.approve") || can(user, "records.submit_own") || can(user, "research.view_department"))) redirect("/forbidden");
  const and: Prisma.ScientificEventWhereInput[] = [{ organizedByInstitute: institute }];
  // الأنشطة المعتمدة التي ينظمها المعهد معلومات عامة لجميع المستخدمين
  if (institute) { if (!manager && !can(user, "records.approve")) and.push({ approval: "APPROVED" }); }
  else and.push(eventsWhere(user));
  if (sp.q) and.push({ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { organizer: { contains: sp.q, mode: "insensitive" } }, { participants: { some: { researcher: { fullName: { contains: sp.q, mode: "insensitive" } } } } }] });
  if (sp.type && sp.type in EventType) and.push({ type: sp.type as EventType });
  if (sp.scope && sp.scope in EventScope) and.push({ scope: sp.scope as EventScope });
  if (sp.approval && sp.approval in RecordStatus) and.push({ approval: sp.approval as RecordStatus });
  if (sp.year && /^\d{4}$/.test(sp.year)) and.push({ startDate: { gte: new Date(`${sp.year}-01-01`), lt: new Date(`${Number(sp.year) + 1}-01-01`) } });
  const events = await db.scientificEvent.findMany({
    where: { AND: and }, orderBy: { startDate: "desc" },
    include: { participants: { include: { researcher: { select: { id: true, fullName: true } } } } },
  });
  const files = await attachmentsFor("EVENT", events.map((e) => e.id));
  const canAdd = institute ? manager : manager || (can(user, "records.submit_own") && !!user.researcherId);
  const thisYear = new Date().getFullYear();
  const title = institute ? "الأنشطة العلمية التي ينظمها المعهد" : "المؤتمرات والندوات وورش العمل";

  return (
    <div className="grid gap-5">
      <PageHeader icon={<Presentation />} title={title}
        description={institute ? "توثيق المؤتمرات والندوات والورش والدورات التي ينظمها مكتب البحث العلمي" : "توثيق المشاركات العلمية لأعضاء هيئة التدريس في الفعاليات المحلية والدولية"}
        actions={canAdd && (
          <FormDialog wide trigger={<Button><Plus /> {institute ? "نشاط جديد" : "إضافة مشاركة"}</Button>} title={institute ? "إضافة نشاط علمي" : "إضافة مشاركة علمية"} action={saveEventAction.bind(null, null)}>
            <EventFields institute={institute} manager={manager} />
          </FormDialog>
        )} />
      <Card className="overflow-hidden">
        <FilterBar basePath={institute ? "/activities" : "/events"} fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالاسم أو الجهة أو المشارك" },
          { type: "select", name: "type", label: "النوع", value: sp.type, options: Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "scope", label: "النطاق", value: sp.scope, options: Object.entries(EVENT_SCOPE_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "year", label: "السنة", value: sp.year, options: Array.from({ length: 6 }, (_, i) => ({ value: String(thisYear - i), label: String(thisYear - i) })) },
          { type: "select", name: "approval", label: "الاعتماد", value: sp.approval, options: Object.entries(RECORD_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
        ]} />
        {events.length === 0 ? <EmptyState title="لا توجد سجلات" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>الفعالية</TableHead><TableHead>النوع</TableHead><TableHead>التاريخ والمكان</TableHead>
              <TableHead>{institute ? "المنظمون / الحضور" : "المشاركون"}</TableHead><TableHead>الاعتماد</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {events.map((e) => {
                const editable = manager || (e.createdById === user.id && e.approval !== "APPROVED");
                return (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-xs">
                      <p className="font-semibold text-navy">{e.name}</p>
                      {e.organizer && !institute && <p className="text-xs text-muted-foreground">{e.organizer}</p>}
                      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">رابط الفعالية</a>}
                      <div className="mt-1"><AttachmentList items={files.get(e.id)} /></div>
                      <ApprovalNote status={e.approval} note={e.approvalNote} />
                    </TableCell>
                    <TableCell className="text-xs">{EVENT_TYPE_LABELS[e.type]}<br /><Badge variant="outline">{EVENT_SCOPE_LABELS[e.scope]}</Badge></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(e.startDate)}<br /><span className="text-muted-foreground">{e.location ?? ""}</span></TableCell>
                    <TableCell className="text-xs">
                      {e.participants.map((p) => <div key={p.id}>{p.researcher.fullName} <span className="text-muted-foreground">({PARTICIPATION_ROLE_LABELS[p.role]})</span></div>)}
                      {e.participants[0]?.paperTitle && <div className="text-muted-foreground">الورقة: {e.participants[0].paperTitle}</div>}
                      {institute && e.attendeesCount != null && <div className="text-muted-foreground">الحضور: {e.attendeesCount}</div>}
                    </TableCell>
                    <TableCell><RecordStatusBadge status={e.approval} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {can(user, "records.approve") && <ApprovalButton status={e.approval} action={decideRecordAction.bind(null, "event", e.id)} />}
                        {editable && (
                          <FormDialog wide trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل السجل" action={saveEventAction.bind(null, e.id)}>
                            <EventFields e={e} institute={institute} manager={manager} />
                          </FormDialog>
                        )}
                        {editable && <ConfirmButton action={deleteEventAction.bind(null, e.id)} title="حذف السجل" confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>}
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
