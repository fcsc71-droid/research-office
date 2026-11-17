import { Award as AwardIcon, Plus, PenLine, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardsWhere } from "@/lib/records-access";
import { attachmentsFor } from "@/lib/attachments";
import { saveAwardAction, deleteAwardAction, decideRecordAction } from "@/actions/records";
import type { Prisma, Award } from "@/generated/prisma/client";
import { AwardType, RecordStatus } from "@/generated/prisma/enums";
import { AWARD_TYPE_LABELS, RECORD_STATUS_LABELS, FILE_ACCEPT_ATTR } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Field } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FieldError } from "@/components/app/action-form";
import { SinglePicker } from "@/components/app/pickers";
import { AttachmentList } from "@/components/app/attachment-list";
import { ApprovalButton, ApprovalNote, RecordStatusBadge } from "@/components/app/record-ui";
import { formatDate, toInputDate } from "@/lib/utils";

export const metadata = { title: "الجوائز والتكريم" };

function Fields({ w, manager, opts }: { w?: Award; manager: boolean; opts: { id: string; name: string; sub?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {manager && <Field label="عضو هيئة التدريس" required className="sm:col-span-2"><SinglePicker name="researcherId" options={opts} defaultValue={w?.researcherId} /></Field>}
      <Field label="اسم الجائزة" required className="sm:col-span-2"><Input name="title" defaultValue={w?.title} required /><FieldError name="title" /></Field>
      <Field label="النوع" required><NativeSelect name="type" defaultValue={w?.type ?? ""} required><option value="">— اختر —</option>{Object.entries(AWARD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      <Field label="الجهة المانحة"><Input name="grantor" defaultValue={w?.grantor ?? ""} /></Field>
      <Field label="تاريخ الحصول" required><Input type="date" name="date" defaultValue={toInputDate(w?.date)} required /><FieldError name="date" /></Field>
      <Field label="الشهادة / المستند"><Input type="file" name="files" multiple accept={FILE_ACCEPT_ATTR} className="h-auto py-2" /></Field>
      <Field label="وصف" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={w?.description ?? ""} /></Field>
    </div>
  );
}

export default async function AwardsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const manager = can(user, "awards.manage");
  if (!(manager || can(user, "records.approve") || can(user, "records.submit_own") || can(user, "research.view_department"))) redirect("/forbidden");
  const sp = await searchParams;
  const and: Prisma.AwardWhereInput[] = [awardsWhere(user)];
  if (sp.q) and.push({ OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { researcher: { fullName: { contains: sp.q, mode: "insensitive" } } }] });
  if (sp.type && sp.type in AwardType) and.push({ type: sp.type as AwardType });
  if (sp.approval && sp.approval in RecordStatus) and.push({ approval: sp.approval as RecordStatus });
  const [awards, researchers] = await Promise.all([
    db.award.findMany({ where: { AND: and }, orderBy: { date: "desc" }, include: { researcher: { select: { fullName: true, department: { select: { name: true } } } } } }),
    manager ? db.researcher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, universityId: true } }) : [],
  ]);
  const files = await attachmentsFor("AWARD", awards.map((a) => a.id));
  const opts = researchers.map((r) => ({ id: r.id, name: r.fullName, sub: r.universityId }));
  const canAdd = manager || (can(user, "records.submit_own") && !!user.researcherId);
  return (
    <div>
      <PageHeader icon={<AwardIcon />} title="الجوائز والتكريم" description="الجوائز العلمية وبراءات الاختراع وشهادات التميز لأعضاء هيئة التدريس"
        actions={canAdd && <FormDialog wide trigger={<Button><Plus /> إضافة جائزة</Button>} title="إضافة جائزة" action={saveAwardAction.bind(null, null)}><Fields manager={manager} opts={opts} /></FormDialog>} />
      <Card className="overflow-hidden">
        <FilterBar basePath="/awards" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالجائزة أو الاسم" },
          { type: "select", name: "type", label: "النوع", value: sp.type, options: Object.entries(AWARD_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "approval", label: "الاعتماد", value: sp.approval, options: Object.entries(RECORD_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
        ]} />
        {awards.length === 0 ? <EmptyState title="لا توجد جوائز مسجلة" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الجائزة</TableHead><TableHead>عضو هيئة التدريس</TableHead><TableHead>النوع</TableHead><TableHead>التاريخ</TableHead><TableHead>الاعتماد</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {awards.map((w) => {
                const editable = manager || (w.createdById === user.id && w.approval !== "APPROVED");
                return (
                  <TableRow key={w.id}>
                    <TableCell className="max-w-sm"><p className="font-semibold text-navy">{w.title}</p><p className="text-xs text-muted-foreground">{w.grantor}</p><AttachmentList items={files.get(w.id)} /><ApprovalNote status={w.approval} note={w.approvalNote} /></TableCell>
                    <TableCell>{w.researcher.fullName}<p className="text-xs text-muted-foreground">{w.researcher.department?.name}</p></TableCell>
                    <TableCell className="text-xs">{AWARD_TYPE_LABELS[w.type]}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(w.date)}</TableCell>
                    <TableCell><RecordStatusBadge status={w.approval} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {can(user, "records.approve") && <ApprovalButton status={w.approval} action={decideRecordAction.bind(null, "award", w.id)} />}
                        {editable && <FormDialog wide trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل الجائزة" action={saveAwardAction.bind(null, w.id)}><Fields w={w} manager={manager} opts={opts} /></FormDialog>}
                        {editable && <ConfirmButton action={deleteAwardAction.bind(null, w.id)} title="حذف الجائزة" confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>}
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
