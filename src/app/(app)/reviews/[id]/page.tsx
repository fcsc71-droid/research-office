import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, Download, FileText, Lock, Send, Save, XCircle } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { saveReviewAction, declineAssignmentAction } from "@/actions/reviews";
import { ASSIGNMENT_STATUS_LABELS, FILE_ACCEPT_ATTR, RECOMMENDATION_LABELS, TYPE_LABELS, LEVEL_LABELS } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ActionForm, FieldError } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { FormDialog } from "@/components/app/form-dialog";
import { FilePreviewButton } from "@/components/app/file-preview";
import { Field, InfoRow, PageHeader } from "@/components/app/misc";
import { formatBytes, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "نموذج التحكيم العلمي" };

const CRITERIA = [
  { name: "qualityScore", label: "جودة البحث العامة", hint: "وضوح المشكلة، الأهمية، الصياغة العلمية" },
  { name: "methodologyScore", label: "المنهجية", hint: "ملاءمة المنهج والأدوات وإجراءات الدراسة" },
  { name: "referencesScore", label: "المراجع", hint: "حداثة المراجع وملاءمتها وصحة التوثيق" },
  { name: "resultsScore", label: "النتائج", hint: "دقة التحليل ومنطقية النتائج والتوصيات" },
  { name: "originalityScore", label: "الأصالة والإضافة العلمية", hint: "الجدة والإسهام المعرفي" },
] as const;

export default async function ReviewFormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("reviews.perform");
  const { id } = await params;
  const settings = await getSettings();
  const a = await db.reviewAssignment.findUnique({
    where: { id },
    include: {
      review: true,
      paper: {
        include: {
          department: true, category: true,
          authors: { orderBy: { order: "asc" } },
          files: { where: { isCurrent: true, category: { not: "REVIEW_REPORT" } }, orderBy: { uploadedAt: "desc" } },
        },
      },
      files: true,
    },
  });
  // المحكم لا يصل إلا للأبحاث المسندة إليه
  if (!a || a.reviewerId !== user.id) notFound();
  const editable = ["PENDING", "IN_PROGRESS"].includes(a.status);
  const r = a.review;
  const p = a.paper;

  return (
    <div className="grid gap-5">
      <PageHeader icon={<ClipboardCheck />} title="نموذج التحكيم العلمي" description={<>البحث <span dir="ltr" className="font-mono">{p.referenceNo}</span> — حالة التكليف: {ASSIGNMENT_STATUS_LABELS[a.status]}</>}
        actions={<Button asChild variant="outline"><Link href="/reviews">العودة للتكليفات</Link></Button>} />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="grid content-start gap-5 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-brand" /> بيانات البحث</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-lg leading-relaxed font-bold text-navy">{p.titleAr}</p>
              {p.titleEn && <p dir="ltr" className="text-sm text-muted-foreground">{p.titleEn}</p>}
              <dl>
                <InfoRow label="النوع">{TYPE_LABELS[p.type]}</InfoRow>
                <InfoRow label="المستوى">{LEVEL_LABELS[p.level]}</InfoRow>
                <InfoRow label="القسم">{p.department?.name}</InfoRow>
                <InfoRow label="التخصص">{p.category?.name}</InfoRow>
                <InfoRow label="الباحثون">{settings.blindReview ? <span className="flex items-center gap-1 text-muted-foreground"><Lock className="size-3" /> مخفي (تحكيم معمّى)</span> : p.authors.map((x) => x.name).join("، ")}</InfoRow>
                <InfoRow label="تاريخ التكليف">{formatDate(a.assignedAt)}</InfoRow>
                <InfoRow label="موعد التسليم"><b className={a.dueDate < new Date() && editable ? "text-destructive" : ""}>{formatDate(a.dueDate)}</b></InfoRow>
              </dl>
              <div>
                <p className="mb-1 text-sm font-bold text-muted-foreground">الملخص</p>
                <p className="text-sm leading-7 whitespace-pre-line">{p.abstract}</p>
              </div>
              {p.keywords.length > 0 && <div className="flex flex-wrap gap-1">{p.keywords.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}</div>}
              {a.instructions && <div className="rounded-md border border-brand/30 bg-brand-soft/30 p-3 text-sm whitespace-pre-line"><b>تعليمات مكتب الأبحاث:</b><br />{a.instructions}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>ملفات البحث</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {p.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0"><p className="truncate font-semibold">{f.title || f.originalName}</p><p className="text-xs text-muted-foreground">{formatBytes(f.size)} · {formatDateTime(f.uploadedAt)}</p></div>
                  <div className="flex">
                    {f.extension === "pdf" && <FilePreviewButton fileId={f.id} name={f.originalName} kind="pdf" />}
                    <Button asChild variant="ghost" size="icon-sm"><a href={`/api/files/${f.id}`} title="تنزيل"><Download /></a></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>التقييم العلمي</CardTitle>
            <CardDescription className="flex items-center gap-1"><Lock className="size-3" /> التقييم سري ولا يطلع عليه إلا مكتب الأبحاث. تظهر «الملاحظات للباحث» فقط للباحث دون ذكر هويتك.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveReviewAction.bind(null, a.id)} className="grid gap-5">
              <fieldset disabled={!editable} className="grid gap-5">
                <div className="grid gap-3">
                  {CRITERIA.map((c) => (
                    <div key={c.name} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]">
                      <div><p className="font-semibold text-navy">{c.label}</p><p className="text-xs text-muted-foreground">{c.hint}</p></div>
                      <div className="flex items-center gap-2">
                        <Input type="number" name={c.name} min={1} max={10} required defaultValue={r?.[c.name] ?? ""} className="w-20 text-center" />
                        <span className="text-sm text-muted-foreground">/ 10</span>
                      </div>
                      <FieldError name={c.name} />
                    </div>
                  ))}
                </div>
                <Field label="توصية المحكم" required>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(RECOMMENDATION_LABELS).map(([k, v]) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
                        <input type="radio" name="recommendation" value={k} required defaultChecked={r?.recommendation === k} className="accent-[var(--brand)]" />
                        {v}
                      </label>
                    ))}
                  </div>
                  <FieldError name="recommendation" />
                </Field>
                <Field label="ملاحظات المحكم للباحث" required hint="تُرسل للباحث دون ذكر هوية المحكم">
                  <Textarea name="commentsToAuthor" rows={7} required minLength={10} defaultValue={r?.commentsToAuthor ?? ""} />
                  <FieldError name="commentsToAuthor" />
                </Field>
                <Field label="ملاحظات سرية لمكتب الأبحاث" hint="لا تظهر للباحث إطلاقاً">
                  <Textarea name="confidentialComments" rows={3} defaultValue={r?.confidentialComments ?? ""} />
                </Field>
                <Field label="إرفاق تقرير التحكيم (اختياري)">
                  <Input type="file" name="reportFile" accept={FILE_ACCEPT_ATTR} className="h-auto py-2" />
                  {a.files.map((f) => <a key={f.id} href={`/api/files/${f.id}`} className="text-xs text-brand hover:underline">التقرير المرفق: {f.originalName}</a>)}
                </Field>
              </fieldset>
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <SubmitButton name="intent" value="draft" variant="outline"><Save /> حفظ كمسودة</SubmitButton>
                  <SubmitButton name="intent" value="submit" pendingText="جارٍ التسليم..."><Send /> تسليم التقييم النهائي</SubmitButton>
                </div>
              ) : (
                <p className="rounded-md bg-muted p-3 text-sm">تم {a.status === "SUBMITTED" ? `تسليم التقييم بتاريخ ${formatDateTime(r?.submittedAt)}` : "إغلاق هذا التكليف"} ولا يمكن تعديله.</p>
              )}
            </ActionForm>
            {editable && (
              <div className="mt-4 border-t pt-4">
                <FormDialog trigger={<Button variant="ghost" size="sm" className="text-destructive"><XCircle /> الاعتذار عن التحكيم</Button>} title="الاعتذار عن التحكيم" description="سيتم إشعار مكتب الأبحاث لتعيين محكم بديل" action={declineAssignmentAction.bind(null, a.id)} submitText="تأكيد الاعتذار">
                  <Field label="سبب الاعتذار" required><Textarea name="reason" required minLength={3} rows={3} /></Field>
                </FormDialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
