import { Handshake, Plus, PenLine, Trash2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentsFor } from "@/lib/attachments";
import { saveCollaborationAction, deleteCollaborationAction } from "@/actions/records";
import type { Prisma, Collaboration } from "@/generated/prisma/client";
import { PartnerType, CollaborationType } from "@/generated/prisma/enums";
import { COLLABORATION_TYPE_LABELS, PARTNER_TYPE_LABELS, FILE_ACCEPT_ATTR } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Field } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FieldError } from "@/components/app/action-form";
import { AttachmentList } from "@/components/app/attachment-list";
import { formatDate, toInputDate } from "@/lib/utils";

export const metadata = { title: "التعاون البحثي" };

function Fields({ c }: { c?: Collaboration }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="الجهة الشريكة" required><Input name="partnerName" defaultValue={c?.partnerName} required /><FieldError name="partnerName" /></Field>
      <Field label="نوع الجهة" required><NativeSelect name="partnerType" defaultValue={c?.partnerType ?? ""} required><option value="">— اختر —</option>{Object.entries(PARTNER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      <Field label="نوع التعاون" required><NativeSelect name="type" defaultValue={c?.type ?? ""} required><option value="">— اختر —</option>{Object.entries(COLLABORATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      <Field label="المنسق من المعهد"><Input name="coordinator" defaultValue={c?.coordinator ?? ""} /></Field>
      <Field label="عنوان الاتفاقية / المشروع" required className="sm:col-span-2"><Input name="title" defaultValue={c?.title} required /><FieldError name="title" /></Field>
      <Field label="تاريخ البداية"><Input type="date" name="startDate" defaultValue={toInputDate(c?.startDate)} /></Field>
      <Field label="تاريخ الانتهاء"><Input type="date" name="endDate" defaultValue={toInputDate(c?.endDate)} /></Field>
      <Field label="الوصف" className="sm:col-span-2"><Textarea name="description" rows={3} defaultValue={c?.description ?? ""} /></Field>
      <Field label="نسخة الاتفاقية / المذكرة" className="sm:col-span-2"><Input type="file" name="files" multiple accept={FILE_ACCEPT_ATTR} className="h-auto py-2" /></Field>
    </div>
  );
}

export default async function CollaborationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("collaborations.manage", "departments.profile");
  const manage = can(user, "collaborations.manage");
  const sp = await searchParams;
  const where: Prisma.CollaborationWhereInput = {};
  if (sp.q) where.OR = [{ partnerName: { contains: sp.q, mode: "insensitive" } }, { title: { contains: sp.q, mode: "insensitive" } }];
  if (sp.partnerType && sp.partnerType in PartnerType) where.partnerType = sp.partnerType as PartnerType;
  if (sp.type && sp.type in CollaborationType) where.type = sp.type as CollaborationType;
  const list = await db.collaboration.findMany({ where, orderBy: { createdAt: "desc" } });
  const files = await attachmentsFor("COLLABORATION", list.map((c) => c.id));
  const now = new Date();
  return (
    <div>
      <PageHeader icon={<Handshake />} title="التعاون البحثي" description="الاتفاقيات ومذكرات التفاهم والمشاريع والبحوث المشتركة مع الجامعات والمراكز والجهات الأخرى"
        actions={manage && <FormDialog wide trigger={<Button><Plus /> إضافة تعاون</Button>} title="إضافة تعاون بحثي" action={saveCollaborationAction.bind(null, null)}><Fields /></FormDialog>} />
      <Card className="overflow-hidden">
        <FilterBar basePath="/collaborations" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالجهة أو العنوان" },
          { type: "select", name: "partnerType", label: "نوع الجهة", value: sp.partnerType, options: Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "type", label: "نوع التعاون", value: sp.type, options: Object.entries(COLLABORATION_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
        ]} />
        {list.length === 0 ? <EmptyState title="لا توجد سجلات تعاون" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الجهة</TableHead><TableHead>التعاون</TableHead><TableHead>الفترة</TableHead><TableHead>الحالة</TableHead>{manage && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {list.map((c) => {
                const active = !c.endDate || c.endDate >= now;
                return (
                  <TableRow key={c.id}>
                    <TableCell><p className="font-semibold text-navy">{c.partnerName}</p><p className="text-xs text-muted-foreground">{PARTNER_TYPE_LABELS[c.partnerType]}</p></TableCell>
                    <TableCell className="max-w-sm">
                      <Badge variant="secondary">{COLLABORATION_TYPE_LABELS[c.type]}</Badge> <span className="text-sm">{c.title}</span>
                      {c.coordinator && <p className="text-xs text-muted-foreground">المنسق: {c.coordinator}</p>}
                      <div className="mt-1"><AttachmentList items={files.get(c.id)} /></div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(c.startDate)}<br />{formatDate(c.endDate)}</TableCell>
                    <TableCell>{active ? <Badge variant="success">سارية</Badge> : <Badge variant="outline">منتهية</Badge>}</TableCell>
                    {manage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <FormDialog wide trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل التعاون" action={saveCollaborationAction.bind(null, c.id)}><Fields c={c} /></FormDialog>
                          <ConfirmButton action={deleteCollaborationAction.bind(null, c.id)} title="حذف السجل" confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>
                        </div>
                      </TableCell>
                    )}
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
