import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderKanban, PenLine, Trash2, FileText, Users } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectsWhere } from "@/lib/records-access";
import { attachmentsFor } from "@/lib/attachments";
import { saveProjectAction, deleteProjectAction, addProjectReportAction, decideRecordAction } from "@/actions/records";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, FILE_ACCEPT_ATTR } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { ProjectFields } from "@/components/app/project-fields";
import { AttachmentList } from "@/components/app/attachment-list";
import { ApprovalButton, ApprovalNote, RecordStatusBadge } from "@/components/app/record-ui";
import { Field, InfoRow, PageHeader } from "@/components/app/misc";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "تفاصيل المشروع البحثي" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.researchProject.findFirst({
    where: { AND: [{ id }, projectsWhere(user)] },
    include: {
      lead: true, department: true,
      members: { include: { researcher: { select: { id: true, userId: true } } } },
      reports: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) notFound();
  const files = (await attachmentsFor("PROJECT", [p.id])).get(p.id);
  const reportAuthors = await db.user.findMany({ where: { id: { in: p.reports.map((r) => r.createdById) } }, select: { id: true, name: true } });
  const manager = can(user, "projects.manage");
  const isTeam = p.lead.userId === user.id || p.members.some((m) => m.researcher?.userId === user.id);
  const editable = manager || ((p.createdById === user.id || p.lead.userId === user.id) && p.approval !== "APPROVED");
  const lastProgress = p.reports[0]?.progress ?? 0;

  return (
    <div className="grid gap-5">
      <PageHeader icon={<FolderKanban />} title={p.title} description={<span className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", PROJECT_STATUS_COLORS[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span>
        <RecordStatusBadge status={p.approval} />
      </span>}
        actions={<>
          {can(user, "records.approve") && <ApprovalButton status={p.approval} action={decideRecordAction.bind(null, "project", p.id)} />}
          {editable && (
            <FormDialog wide trigger={<Button variant="outline"><PenLine /> تعديل</Button>} title="تعديل المشروع" action={saveProjectAction.bind(null, p.id)}>
              <ProjectFields p={p} manager={manager} />
            </FormDialog>
          )}
          {editable && <ConfirmButton action={deleteProjectAction.bind(null, p.id)} title="حذف المشروع" description="سيتم حذف المشروع وتقاريره ومرفقاته." confirmText="حذف" variant="outline" size="default" className="text-destructive"><Trash2 /> حذف</ConfirmButton>}
        </>} />
      <ApprovalNote status={p.approval} note={p.approvalNote} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>بيانات المشروع</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="الباحث الرئيسي"><Link href={`/researchers/${p.lead.id}`} className="text-navy hover:underline">{p.lead.fullName}</Link></InfoRow>
              <InfoRow label="القسم">{p.department?.name}</InfoRow>
              <InfoRow label="تاريخ البداية">{formatDate(p.startDate)}</InfoRow>
              <InfoRow label="النهاية المتوقعة">{formatDate(p.expectedEndDate)}</InfoRow>
              <InfoRow label="الجهات المتعاونة / الممولة">{p.partners}</InfoRow>
              <InfoRow label="دورية التقرير">{p.reportEveryMonths ? `كل ${p.reportEveryMonths} أشهر` : "—"}</InfoRow>
              <InfoRow label="موعد التقرير القادم">{formatDate(p.nextReportDue)}</InfoRow>
              <InfoRow label="نسبة الإنجاز">
                <div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand" style={{ width: `${lastProgress}%` }} /></div><b>{lastProgress}%</b></div>
              </InfoRow>
            </dl>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>الأهداف والملخص والمخرجات</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7">
            <div><b className="text-navy">الأهداف:</b><p className="whitespace-pre-line">{p.objectives ?? "—"}</p></div>
            <div><b className="text-navy">الملخص:</b><p className="whitespace-pre-line">{p.summary ?? "—"}</p></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><b className="text-navy">المخرجات المتوقعة:</b><p className="whitespace-pre-line">{p.expectedOutputs ?? "—"}</p></div>
              <div><b className="text-navy">المخرجات الفعلية:</b><p className="whitespace-pre-line">{p.actualOutputs ?? "—"}</p></div>
            </div>
            <div>
              <b className="flex items-center gap-1 text-navy"><Users className="size-4" /> الفريق البحثي:</b>
              <p>{[p.lead.fullName + " (رئيسي)", ...p.members.map((m) => m.name)].join("، ")}</p>
            </div>
            <div><b className="text-navy">المرفقات:</b> {files?.length ? <AttachmentList items={files} /> : <span className="text-muted-foreground">لا توجد</span>}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-brand" /> تقارير الإنجاز الدورية</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {(isTeam || manager) && ["APPROVED", "IN_PROGRESS", "COMPLETED"].includes(p.status) && (
            <ActionForm action={addProjectReportAction.bind(null, p.id)} resetOnSuccess className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
              <Field label="الفترة" required><Input name="period" required placeholder="مثال: الربع الأول 2026" /></Field>
              <Field label="نسبة الإنجاز %" required><Input type="number" name="progress" min={0} max={100} required defaultValue={lastProgress} /></Field>
              <Field label="مرفقات" className="md:col-span-2"><Input type="file" name="files" multiple accept={FILE_ACCEPT_ATTR} className="h-auto bg-card py-2" /></Field>
              <Field label="ملخص الإنجاز" required className="md:col-span-4"><Textarea name="body" rows={3} required minLength={10} className="bg-card" /></Field>
              <div><SubmitButton>إرسال التقرير</SubmitButton></div>
            </ActionForm>
          )}
          {p.reports.length === 0 && <p className="text-sm text-muted-foreground">لم تُقدَّم تقارير إنجاز بعد.</p>}
          {p.reports.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <p className="font-bold text-navy">{r.period} — {r.progress}%</p>
              <p className="text-xs text-muted-foreground">{reportAuthors.find((a) => a.id === r.createdById)?.name} · {formatDateTime(r.createdAt)}</p>
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
