import { Library, Plus, PenLine, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveJournalAction, deleteJournalAction } from "@/actions/records";
import type { Prisma } from "@/generated/prisma/client";
import { IndexingType, Quartile } from "@/generated/prisma/enums";
import { INDEXING_LABELS, QUARTILE_LABELS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, Field } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FieldError } from "@/components/app/action-form";
import { daysFromNow, formatDate } from "@/lib/utils";
import type { Journal } from "@/generated/prisma/client";

export const metadata = { title: "المجلات العلمية" };

function JournalFields({ j }: { j?: Journal }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="اسم المجلة" required className="sm:col-span-2"><Input name="name" defaultValue={j?.name} required /><FieldError name="name" /></Field>
      <Field label="الناشر"><Input name="publisher" defaultValue={j?.publisher ?? ""} /></Field>
      <Field label="ISSN"><Input name="issn" defaultValue={j?.issn ?? ""} dir="ltr" className="text-left" placeholder="1234-567X" /><FieldError name="issn" /></Field>
      <Field label="قاعدة الفهرسة"><NativeSelect name="indexing" defaultValue={j?.indexing ?? "NONE"}>{Object.entries(INDEXING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      <Field label="تصنيف الربع (Quartile)"><NativeSelect name="quartile" defaultValue={j?.quartile ?? "NONE"}>{Object.entries(QUARTILE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      <Field label="مجال التخصص"><Input name="field" defaultValue={j?.field ?? ""} /></Field>
      <Field label="رابط المجلة"><Input type="url" name="url" defaultValue={j?.url ?? ""} dir="ltr" className="text-left" /><FieldError name="url" /></Field>
      <label className="flex items-start gap-2 text-sm font-semibold sm:col-span-2">
        <Checkbox name="indexingVerified" defaultChecked={j?.indexingVerified} className="mt-1" />
        <span>تم التحقق من الفهرسة اليوم <span className="block text-xs font-normal text-muted-foreground">يُسجَّل تاريخ التحقق، لأن تصنيف المجلات وقواعد الفهرسة قد تتغير؛ ويُنصح بإعادة التحقق سنوياً</span></span>
      </label>
    </div>
  );
}

export default async function JournalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const manage = can(user, "journals.manage");
  if (!manage && !can(user, "research.create") && !can(user, "research.view_all")) redirect("/forbidden");
  const sp = await searchParams;
  const where: Prisma.JournalWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { issn: { contains: sp.q } }, { publisher: { contains: sp.q, mode: "insensitive" } }, { field: { contains: sp.q, mode: "insensitive" } }];
  if (sp.indexing && sp.indexing in IndexingType) where.indexing = sp.indexing as IndexingType;
  if (sp.quartile && sp.quartile in Quartile) where.quartile = sp.quartile as Quartile;
  const journals = await db.journal.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { papers: true } } } });
  const yearAgo = daysFromNow(-365);

  return (
    <div>
      <PageHeader icon={<Library />} title="المجلات العلمية والنشر" description="قاعدة بيانات المجلات التي ينشر فيها أعضاء هيئة التدريس مع تصنيفها وحالة التحقق من فهرستها"
        actions={manage && <FormDialog wide trigger={<Button><Plus /> إضافة مجلة</Button>} title="إضافة مجلة علمية" action={saveJournalAction.bind(null, null)}><JournalFields /></FormDialog>} />
      <Card className="overflow-hidden">
        <FilterBar basePath="/journals" fields={[
          { type: "search", name: "q", value: sp.q, placeholder: "ابحث بالاسم، ISSN، الناشر، المجال" },
          { type: "select", name: "indexing", label: "الفهرسة", value: sp.indexing, options: Object.entries(INDEXING_LABELS).map(([value, label]) => ({ value, label })) },
          { type: "select", name: "quartile", label: "الربع", value: sp.quartile, options: Object.entries(QUARTILE_LABELS).map(([value, label]) => ({ value, label })) },
        ]} />
        {journals.length === 0 ? <EmptyState title="لا توجد مجلات مسجلة" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>المجلة</TableHead><TableHead>ISSN</TableHead><TableHead>الفهرسة</TableHead><TableHead>الربع</TableHead><TableHead>التحقق</TableHead><TableHead>الأبحاث</TableHead>{manage && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {journals.map((j) => {
                const stale = !j.indexingVerified || !j.verifiedAt || j.verifiedAt < yearAgo;
                return (
                  <TableRow key={j.id}>
                    <TableCell>
                      {j.url ? <a href={j.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline">{j.name}</a> : <span className="font-semibold text-navy">{j.name}</span>}
                      <p className="text-xs text-muted-foreground">{[j.publisher, j.field].filter(Boolean).join(" · ")}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{j.issn ?? "—"}</TableCell>
                    <TableCell className="text-xs">{INDEXING_LABELS[j.indexing]}</TableCell>
                    <TableCell>{j.quartile !== "NONE" ? <Badge>{j.quartile}</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {stale ? <span className="flex items-center gap-1 text-amber-700"><ShieldAlert className="size-3" /> تحتاج تحقق</span> : <span className="flex items-center gap-1 text-emerald-700"><ShieldCheck className="size-3" /> {formatDate(j.verifiedAt)}</span>}
                    </TableCell>
                    <TableCell className="font-bold text-navy">{j._count.papers}</TableCell>
                    {manage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <FormDialog wide trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل المجلة" action={saveJournalAction.bind(null, j.id)}><JournalFields j={j} /></FormDialog>
                          <ConfirmButton action={deleteJournalAction.bind(null, j.id)} title="حذف المجلة" description="ستبقى الأبحاث المرتبطة بها دون مجلة." confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>
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
