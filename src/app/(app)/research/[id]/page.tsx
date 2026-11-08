import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Download, FileDown, FileText, History, MessageSquare, PenLine, Printer, Trash2, Upload, UserPlus, Users,
  ClipboardCheck, Replace, CheckCircle2, CalendarClock, Ban, Send, ShieldCheck, Lock,
} from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPaperAccess } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { TRANSITIONS } from "@/lib/workflow";
import {
  ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUS_LABELS, COMMENT_TYPE_LABELS, FILE_ACCEPT_ATTR, FILE_CATEGORY_LABELS,
  LEVEL_LABELS, RECOMMENDATION_LABELS, STATUS_LABELS, TYPE_LABELS,
} from "@/lib/constants";
import {
  addCommentAction, assignReviewerAction, cancelAssignmentAction, changeStatusAction, deleteFileAction, deletePaperAction,
  extendDeadlineAction, submitRevisionAction, toggleCommentResolvedAction, uploadFileAction,
} from "@/actions/research";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { FilePreviewButton } from "@/components/app/file-preview";
import { Field, InfoRow, StatusBadge, EmptyState } from "@/components/app/misc";
import { cn, daysFromNow, formatBytes, formatDate, formatDateTime, toInputDate } from "@/lib/utils";

export const metadata = { title: "تفاصيل البحث" };

export default async function ResearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const settings = await getSettings();
  const paper = await db.researchPaper.findUnique({
    where: { id },
    include: {
      mainResearcher: true,
      college: true,
      department: true,
      category: true,
      createdBy: { select: { name: true } },
      authors: { orderBy: { order: "asc" }, include: { researcher: { select: { id: true, universityId: true } } } },
      files: { orderBy: { uploadedAt: "desc" }, include: { uploadedBy: { select: { name: true } }, version: { select: { versionNo: true } } } },
      versions: { orderBy: { versionNo: "desc" }, include: { createdBy: { select: { name: true } }, _count: { select: { files: true } } } },
      assignments: {
        orderBy: [{ round: "desc" }, { assignedAt: "desc" }],
        include: { reviewer: { select: { name: true, academicTitle: true } }, review: true, files: { select: { id: true, originalName: true } } },
      },
      comments: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true, role: { select: { name: true } } } } } },
      statusHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!paper) notFound();
  const access = await getPaperAccess(user, paper, settings.blindReview);
  if (!access.canView) notFound();

  const staffView = access.staff;
  const transitions = TRANSITIONS[paper.status].filter((t) => can(user, t.perm));
  const ownerCanSubmit = access.owner && paper.status === "DRAFT" && settings.allowResearcherSelfSubmit && !transitions.some((t) => t.to === "SUBMITTED");
  const currentFiles = paper.files.filter((f) => f.isCurrent && (f.category !== "REVIEW_REPORT" || access.canSeeReviews));
  const oldFiles = paper.files.filter((f) => !f.isCurrent && (f.category !== "REVIEW_REPORT" || access.canSeeReviews));
  const myAssignment = paper.assignments.find((a) => a.reviewerId === user.id && !["CANCELLED"].includes(a.status));
  const visibleComments = paper.comments.filter((c) => c.type !== "INTERNAL" || can(user, "research.comment"));
  const showReviewsToOwner = access.owner && ["NEEDS_REVISION", "RESUBMITTED", "ACCEPTED", "REJECTED", "PUBLISHED", "ARCHIVED"].includes(paper.status);
  const submittedReviews = paper.assignments.filter((a) => a.review && !a.review.isDraft);
  const canDelete = can(user, "research.delete") || (paper.status === "DRAFT" && paper.createdById === user.id);
  const canExport = staffView || access.owner || access.archiveReader;

  const reviewers = can(user, "reviews.assign")
    ? await db.user.findMany({
        where: { isActive: true, role: { OR: [{ key: "REVIEWER" }, { permissions: { some: { permission: { code: "reviews.perform" } } } }] } },
        select: { id: true, name: true, specialization: true, _count: { select: { reviewAssignments: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } } } } },
        orderBy: { name: "asc" },
      })
    : [];
  const defaultDue = toInputDate(daysFromNow(settings.defaultReviewDays));

  return (
    <div className="grid gap-5">
      {/* الترويسة */}
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-l from-navy via-brand to-sky-300" />
        <CardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-navy">{paper.referenceNo}</span>
              <StatusBadge status={paper.status} />
              <Badge variant="outline">{TYPE_LABELS[paper.type]}</Badge>
              <Badge variant="outline">{LEVEL_LABELS[paper.level]}</Badge>
            </div>
            <h1 className="text-xl leading-relaxed font-extrabold text-navy sm:text-2xl">{paper.titleAr}</h1>
            {paper.titleEn && <p dir="ltr" className="text-left text-sm text-muted-foreground lg:text-right">{paper.titleEn}</p>}
          </div>
          <div className="no-print flex shrink-0 flex-wrap gap-2">
            {access.canEditMeta && <Button asChild variant="outline" size="sm"><Link href={`/research/${paper.id}/edit`}><PenLine /> تعديل</Link></Button>}
            {canExport && (
              <>
                <Button asChild variant="outline" size="sm"><a href={`/api/research/${paper.id}/pdf`}><FileDown /> تصدير PDF</a></Button>
                <Button asChild variant="outline" size="sm"><a href={`/api/research/${paper.id}/pdf?print=1`} target="_blank" rel="noopener"><Printer /> طباعة</a></Button>
              </>
            )}
            {canDelete && (
              <ConfirmButton action={deletePaperAction.bind(null, paper.id)} title="حذف البحث" description="سيتم حذف البحث وجميع ملفاته وتقييماته نهائياً. لا يمكن التراجع عن هذا الإجراء." confirmText="حذف نهائي" variant="outline" className="text-destructive">
                <Trash2 /> حذف
              </ConfirmButton>
            )}
          </div>
        </CardContent>
      </Card>

      {/* سير العمل */}
      {(transitions.length > 0 || ownerCanSubmit || (paper.status === "NEEDS_REVISION" && (access.owner || can(user, "files.manage"))) || myAssignment) && (
        <Card className="no-print border-brand/30 bg-brand-soft/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> إجراءات سير العمل</CardTitle>
            <CardDescription>الحالة الحالية: <b>{STATUS_LABELS[paper.status]}</b></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {transitions.length > 0 && (
              <ActionForm action={changeStatusAction.bind(null, paper.id)} className="grid gap-3 rounded-lg border bg-card p-4" resetOnSuccess>
                <Field label="الإجراء">
                  <NativeSelect name="to" required defaultValue="">
                    <option value="" disabled>— اختر الإجراء —</option>
                    {transitions.map((t) => <option key={t.to} value={t.to}>{t.label} ← {STATUS_LABELS[t.to]}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="ملاحظات / مبررات القرار" hint="إلزامية عند طلب التعديلات، وتظهر للباحث في القرارات وطلبات التعديل. عند النشر اكتب بيانات النشر.">
                  <Textarea name="note" rows={3} maxLength={4000} />
                </Field>
                <SubmitButton className="w-fit">تنفيذ الإجراء</SubmitButton>
              </ActionForm>
            )}
            {ownerCanSubmit && (
              <ActionForm action={changeStatusAction.bind(null, paper.id)} className="grid content-start gap-3 rounded-lg border bg-card p-4">
                <input type="hidden" name="to" value="SUBMITTED" />
                <p className="text-sm">البحث محفوظ كمسودة. بعد التأكد من البيانات وإرفاق ملف البحث، قدّمه إلى مكتب الأبحاث للمراجعة.</p>
                <SubmitButton className="w-fit"><Send /> تقديم البحث</SubmitButton>
              </ActionForm>
            )}
            {paper.status === "NEEDS_REVISION" && (access.owner || can(user, "files.manage")) && (
              <ActionForm action={submitRevisionAction.bind(null, paper.id)} className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                <p className="font-bold text-amber-900">إرسال النسخة المعدلة</p>
                <Field label="ملف النسخة المعدلة" required>
                  <Input type="file" name="file" accept={FILE_ACCEPT_ATTR} required className="h-auto bg-card py-2" />
                </Field>
                <Field label="خطاب الرد على الملاحظات">
                  <Textarea name="note" rows={3} className="bg-card" placeholder="وضح التعديلات التي أجريتها استجابة لملاحظات المحكمين" />
                </Field>
                <SubmitButton className="w-fit" pendingText="جارٍ الإرسال..."><Send /> إرسال النسخة المعدلة</SubmitButton>
              </ActionForm>
            )}
            {myAssignment && (
              <div className="grid content-start gap-2 rounded-lg border bg-card p-4">
                <p className="font-bold text-navy">أنت محكم لهذا البحث</p>
                <p className="text-sm text-muted-foreground">حالة التكليف: {ASSIGNMENT_STATUS_LABELS[myAssignment.status]} — موعد التسليم {formatDate(myAssignment.dueDate)}</p>
                <Button asChild className="w-fit"><Link href={`/reviews/${myAssignment.id}`}><ClipboardCheck /> فتح نموذج التحكيم</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="details">
        <TabsList className="no-print">
          <TabsTrigger value="details"><FileText /> البيانات</TabsTrigger>
          <TabsTrigger value="files"><Upload /> الملفات ({currentFiles.length})</TabsTrigger>
          {(staffView || access.canSeeReviews || can(user, "reviews.assign") || showReviewsToOwner) && (
            <TabsTrigger value="reviews"><ClipboardCheck /> التحكيم ({paper.assignments.filter((a) => a.status !== "CANCELLED").length})</TabsTrigger>
          )}
          {(staffView || access.owner) && <TabsTrigger value="comments"><MessageSquare /> الملاحظات ({visibleComments.length})</TabsTrigger>}
          {(staffView || access.owner) && <TabsTrigger value="history"><History /> السجل</TabsTrigger>}
        </TabsList>

        {/* البيانات */}
        <TabsContent value="details" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>الملخص</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="leading-8 whitespace-pre-line">{paper.abstract}</p>
              {paper.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {paper.keywords.map((k) => <Link key={k} href={`/archive?keyword=${encodeURIComponent(k)}`}><Badge variant="secondary">#{k}</Badge></Link>)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>معلومات البحث</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="الكلية">{paper.college?.name}</InfoRow>
                <InfoRow label="القسم">{paper.department?.name}</InfoRow>
                <InfoRow label="التخصص">{paper.category?.name}{paper.specialization && paper.specialization !== paper.category?.name ? ` — ${paper.specialization}` : ""}</InfoRow>
                <InfoRow label="المشرف">{paper.supervisorName}</InfoRow>
                <InfoRow label="تاريخ التقديم">{formatDate(paper.submittedAt)}</InfoRow>
                {paper.decidedAt && <InfoRow label="تاريخ القرار">{formatDate(paper.decidedAt)}</InfoRow>}
                {paper.publishedAt && <InfoRow label="تاريخ النشر">{formatDate(paper.publishedAt)}</InfoRow>}
                {paper.publicationInfo && <InfoRow label="بيانات النشر">{paper.publicationInfo}</InfoRow>}
                {staffView && <InfoRow label="أُنشئ بواسطة">{paper.createdBy.name} — {formatDate(paper.createdAt)}</InfoRow>}
              </dl>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4 text-brand" /> الباحثون</CardTitle></CardHeader>
            <CardContent>
              {access.canSeeAuthors ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {paper.authors.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className={cn("flex size-9 items-center justify-center rounded-full text-sm font-bold", a.role === "MAIN" ? "bg-navy text-white" : "bg-secondary text-navy")}>
                        {a.name.replace(/^(د\.|أ\.د\.)\s*/, "").charAt(0)}
                      </span>
                      <div className="min-w-0">
                        {a.researcher && can(user, "researchers.view") ? (
                          <Link href={`/researchers/${a.researcher.id}`} className="font-semibold text-navy hover:underline">{a.name}</Link>
                        ) : (
                          <p className="font-semibold text-navy">{a.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{a.role === "MAIN" ? "الباحث الرئيسي" : "باحث مشارك"}{a.researcher ? ` · ${a.researcher.universityId}` : " · من خارج السجل"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" /> التحكيم معمّى: هوية الباحثين مخفية عن المحكمين.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الملفات */}
        <TabsContent value="files" className="grid gap-4">
          {access.canUpload && (
            <Card className="no-print">
              <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-4 text-brand" /> رفع ملف جديد</CardTitle></CardHeader>
              <CardContent>
                <ActionForm action={uploadFileAction.bind(null, paper.id)} resetOnSuccess className="grid items-end gap-3 md:grid-cols-4">
                  <Field label="الملف" required className="md:col-span-2">
                    <Input type="file" name="file" accept={FILE_ACCEPT_ATTR} required className="h-auto py-2" />
                  </Field>
                  <Field label="التصنيف">
                    <NativeSelect name="category" defaultValue="ATTACHMENT">
                      {Object.entries(FILE_CATEGORY_LABELS).filter(([k]) => k !== "REVIEW_REPORT").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="وصف مختصر"><Input name="title" maxLength={200} /></Field>
                  <p className="text-xs text-muted-foreground md:col-span-3">المسموح: PDF, DOCX, DOC, XLSX, PPTX، والصور — الحد الأقصى {settings.maxUploadMb} م.ب. يتم فحص نوع الملف الحقيقي.</p>
                  <SubmitButton pendingText="جارٍ الرفع..."><Upload /> رفع</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>الملفات الحالية</CardTitle></CardHeader>
            {currentFiles.length === 0 ? <EmptyState title="لا توجد ملفات مرفوعة" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الملف</TableHead><TableHead>التصنيف</TableHead><TableHead>الإصدار</TableHead><TableHead>الحجم</TableHead>
                    <TableHead>رفع بواسطة</TableHead><TableHead>تاريخ الرفع</TableHead><TableHead className="no-print">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentFiles.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <p className="font-semibold text-navy">{f.title || f.originalName}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{f.originalName}</p>
                        {f.replacesId && <Badge variant="warning" className="mt-1">نسخة بديلة</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{FILE_CATEGORY_LABELS[f.category]}</TableCell>
                      <TableCell className="text-xs">{f.version ? `v${f.version.versionNo}` : "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatBytes(f.size)}</TableCell>
                      <TableCell className="text-xs">{f.uploadedBy.name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(f.uploadedAt)}</TableCell>
                      <TableCell className="no-print">
                        <div className="flex items-center gap-1">
                          {(f.extension === "pdf" || f.mimeType.startsWith("image/")) && <FilePreviewButton fileId={f.id} name={f.originalName} kind={f.extension === "pdf" ? "pdf" : "image"} />}
                          <Button asChild variant="ghost" size="icon-sm" title="تنزيل"><a href={`/api/files/${f.id}`}><Download /></a></Button>
                          {access.canUpload && f.category !== "REVIEW_REPORT" && (
                            <FormDialog trigger={<Button variant="ghost" size="icon-sm" title="استبدال بنسخة جديدة"><Replace /></Button>} title="استبدال الملف" description="سيتم الاحتفاظ بالنسخة الحالية في سجل الإصدارات" action={uploadFileAction.bind(null, paper.id)} submitText="رفع النسخة الجديدة">
                              <input type="hidden" name="replacesId" value={f.id} />
                              <input type="hidden" name="category" value={f.category} />
                              <Field label="الملف الجديد" required><Input type="file" name="file" accept={FILE_ACCEPT_ATTR} required className="h-auto py-2" /></Field>
                              <Field label="الوصف"><Input name="title" defaultValue={f.title ?? ""} /></Field>
                            </FormDialog>
                          )}
                          {can(user, "files.manage") && (
                            <ConfirmButton action={deleteFileAction.bind(null, f.id)} title="حذف الملف" description={`سيتم حذف الملف "${f.originalName}" نهائياً.`} confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive">
                              <Trash2 />
                            </ConfirmButton>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {oldFiles.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4 text-brand" /> سجل الإصدارات السابقة</CardTitle></CardHeader>
              <Table>
                <TableBody>
                  {oldFiles.map((f) => (
                    <TableRow key={f.id} className="text-muted-foreground">
                      <TableCell><span className="line-through decoration-muted-foreground/40">{f.title || f.originalName}</span> <span className="text-xs" dir="ltr">({f.originalName})</span></TableCell>
                      <TableCell className="text-xs">{f.version ? `v${f.version.versionNo}` : "—"}</TableCell>
                      <TableCell className="text-xs">{f.uploadedBy.name}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(f.uploadedAt)}</TableCell>
                      <TableCell><Button asChild variant="ghost" size="icon-sm"><a href={`/api/files/${f.id}`} title="تنزيل"><Download /></a></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">
            {settings.watermarkOnDownloads ? "ملاحظة: تُنزّل ملفات PDF مختومة بالعلامة المائية للنظام." : ""}
          </p>
        </TabsContent>

        {/* التحكيم */}
        <TabsContent value="reviews" className="grid gap-4">
          {can(user, "reviews.assign") && !["DRAFT", "ACCEPTED", "REJECTED", "PUBLISHED", "ARCHIVED"].includes(paper.status) && (
            <Card className="no-print">
              <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-4 text-brand" /> تعيين محكم</CardTitle></CardHeader>
              <CardContent>
                <ActionForm action={assignReviewerAction.bind(null, paper.id)} resetOnSuccess className="grid items-end gap-3 md:grid-cols-4">
                  <Field label="المحكم" required className="md:col-span-2">
                    <NativeSelect name="reviewerId" required defaultValue="">
                      <option value="" disabled>— اختر المحكم —</option>
                      {reviewers.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}{r.specialization ? ` — ${r.specialization}` : ""} ({r._count.reviewAssignments} تكليف نشط)</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="موعد التسليم" required><Input type="date" name="dueDate" defaultValue={defaultDue} required /></Field>
                  <SubmitButton><UserPlus /> تعيين</SubmitButton>
                  <Field label="تعليمات للمحكم" className="md:col-span-4"><Textarea name="instructions" rows={2} maxLength={2000} /></Field>
                </ActionForm>
              </CardContent>
            </Card>
          )}
          {(staffView || access.canSeeReviews) && (
            <Card className="overflow-hidden">
              <CardHeader><CardTitle>تكليفات التحكيم</CardTitle></CardHeader>
              {paper.assignments.length === 0 ? <EmptyState title="لم يتم تعيين محكمين بعد" /> : (
                <div className="grid gap-3 p-4 pt-0">
                  {paper.assignments.map((a, idx) => {
                    const late = ["PENDING", "IN_PROGRESS"].includes(a.status) && a.dueDate < new Date();
                    const showContent = access.canSeeReviews && a.review && !a.review.isDraft;
                    return (
                      <div key={a.id} className={cn("rounded-lg border p-4", a.status === "CANCELLED" && "opacity-60")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-navy">{access.canSeeReviews || can(user, "reviews.assign") ? `${a.reviewer.academicTitle ? a.reviewer.academicTitle + " " : ""}${a.reviewer.name}` : `محكم ${idx + 1}`}</p>
                            <p className="text-xs text-muted-foreground">
                              الجولة {a.round} · التكليف {formatDate(a.assignedAt)} · <span className={cn(late && "font-bold text-destructive")}>التسليم {formatDate(a.dueDate)}{late && " (متأخر)"}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", ASSIGNMENT_STATUS_COLORS[a.status])}>{ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                            {can(user, "reviews.assign") && ["PENDING", "IN_PROGRESS"].includes(a.status) && (
                              <>
                                <FormDialog trigger={<Button variant="ghost" size="icon-sm" title="تمديد الموعد"><CalendarClock /></Button>} title="تعديل موعد التسليم" action={extendDeadlineAction.bind(null, a.id)}>
                                  <Field label="الموعد الجديد"><Input type="date" name="dueDate" defaultValue={toInputDate(a.dueDate)} required /></Field>
                                </FormDialog>
                                <ConfirmButton action={cancelAssignmentAction.bind(null, a.id)} title="إلغاء التكليف" description="سيتم إلغاء تكليف هذا المحكم وإشعاره بذلك." confirmText="إلغاء التكليف" variant="ghost" size="icon-sm" className="text-destructive">
                                  <Ban />
                                </ConfirmButton>
                              </>
                            )}
                          </div>
                        </div>
                        {a.instructions && <p className="mt-2 rounded bg-muted/60 px-3 py-2 text-xs whitespace-pre-line">{a.instructions}</p>}
                        {showContent && a.review && (
                          <div className="mt-3 grid gap-3 border-t pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={a.review.recommendation === "REJECT" ? "destructive" : a.review.recommendation === "ACCEPT" ? "success" : "warning"}>
                                {RECOMMENDATION_LABELS[a.review.recommendation]}
                              </Badge>
                              <span className="text-sm font-bold text-navy">الدرجة الكلية: {a.review.overallScore.toFixed(1)} / 10</span>
                              <span className="text-xs text-muted-foreground">سُلِّم {formatDateTime(a.review.submittedAt)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                              {[["جودة البحث", a.review.qualityScore], ["المنهجية", a.review.methodologyScore], ["المراجع", a.review.referencesScore], ["النتائج", a.review.resultsScore], ["الأصالة", a.review.originalityScore]].map(([l, v]) => (
                                <div key={l as string} className="rounded-md border bg-muted/40 p-2 text-center">
                                  <p className="text-[11px] text-muted-foreground">{l}</p>
                                  <p className="font-extrabold text-navy">{v}/10</p>
                                </div>
                              ))}
                            </div>
                            <div><p className="text-xs font-bold text-muted-foreground">ملاحظات للباحث</p><p className="text-sm whitespace-pre-line">{a.review.commentsToAuthor}</p></div>
                            {a.review.confidentialComments && (
                              <div className="rounded-md border border-rose-200 bg-rose-50/60 p-2">
                                <p className="flex items-center gap-1 text-xs font-bold text-rose-800"><Lock className="size-3" /> ملاحظات سرية لمكتب الأبحاث</p>
                                <p className="text-sm whitespace-pre-line">{a.review.confidentialComments}</p>
                              </div>
                            )}
                            {a.files.map((f) => <a key={f.id} href={`/api/files/${f.id}`} className="flex w-fit items-center gap-1 text-xs text-brand hover:underline"><Download className="size-3" /> {f.originalName}</a>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
          {showReviewsToOwner && !staffView && (
            <Card>
              <CardHeader><CardTitle>ملاحظات المحكمين</CardTitle><CardDescription>تُعرض الملاحظات دون هوية المحكمين</CardDescription></CardHeader>
              <CardContent className="grid gap-3">
                {submittedReviews.length === 0 && <EmptyState title="لا توجد ملاحظات تحكيم متاحة" />}
                {submittedReviews.map((a, i) => (
                  <div key={a.id} className="rounded-lg border p-3">
                    <p className="mb-1 font-bold text-navy">المحكم {i + 1} <span className="text-xs font-normal text-muted-foreground">— الجولة {a.round}</span></p>
                    <p className="text-sm whitespace-pre-line">{a.review!.commentsToAuthor}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* الملاحظات */}
        <TabsContent value="comments" className="grid gap-4">
          {(can(user, "research.comment") || access.owner) && (
            <Card className="no-print">
              <CardContent className="pt-5">
                <ActionForm action={addCommentAction.bind(null, paper.id)} resetOnSuccess className="grid gap-3">
                  <Textarea name="body" rows={3} required minLength={2} maxLength={4000} placeholder={access.owner && !can(user, "research.comment") ? "اكتب ردك أو استفسارك لمكتب الأبحاث..." : "اكتب ملاحظة..."} />
                  <div className="flex flex-wrap items-center gap-2">
                    {can(user, "research.comment") && (
                      <div className="w-56">
                        <NativeSelect name="type" defaultValue="NOTE">
                          <option value="NOTE">ملاحظة (تظهر للباحث)</option>
                          <option value="REVISION_REQUEST">طلب تعديل</option>
                          <option value="DECISION">قرار</option>
                          <option value="INTERNAL">ملاحظة داخلية (لا تظهر للباحث)</option>
                        </NativeSelect>
                      </div>
                    )}
                    <SubmitButton><MessageSquare /> إضافة</SubmitButton>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="grid gap-3 pt-5">
              {visibleComments.length === 0 && <EmptyState title="لا توجد ملاحظات" />}
              {visibleComments.map((c) => (
                <div key={c.id} className={cn("rounded-lg border p-3", c.type === "REVISION_REQUEST" && "border-amber-200 bg-amber-50/50", c.type === "INTERNAL" && "border-dashed bg-muted/40", c.isResolved && "opacity-60")}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm"><b className="text-navy">{c.author.name}</b> <span className="text-xs text-muted-foreground">({c.author.role.name})</span></p>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.type === "REVISION_REQUEST" ? "warning" : "secondary"}>{COMMENT_TYPE_LABELS[c.type]}</Badge>
                      {c.isResolved && <Badge variant="success"><CheckCircle2 /> منجزة</Badge>}
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      {can(user, "research.comment") && c.type === "REVISION_REQUEST" && (
                        <ConfirmButton action={toggleCommentResolvedAction.bind(null, c.id)} title={c.isResolved ? "إعادة فتح" : "تعليم كمنجزة"} confirmVariant="default" variant="ghost" size="sm">
                          <CheckCircle2 /> {c.isResolved ? "إعادة فتح" : "منجزة"}
                        </ConfirmButton>
                      )}
                    </div>
                  </div>
                  <p className="text-sm leading-7 whitespace-pre-line">{c.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* السجل */}
        <TabsContent value="history" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>سجل تغيير الحالات</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative grid gap-4 border-r-2 border-brand-soft pr-4">
                {paper.statusHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1 -right-[23px] size-3 rounded-full border-2 border-white bg-brand" />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {h.fromStatus && <><StatusBadge status={h.fromStatus} /> ←</>}
                      <StatusBadge status={h.toStatus} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{h.changedBy.name} · {formatDateTime(h.createdAt)}</p>
                    {h.note && <p className="mt-1 text-sm whitespace-pre-line">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>نسخ البحث (جولات التقديم)</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {paper.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-bold text-navy">الإصدار {v.versionNo} {v === paper.versions[0] && <Badge variant="success" className="ms-1">الحالي</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{v.note} · {v.createdBy.name} · {formatDateTime(v.createdAt)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{v._count.files} ملف</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
