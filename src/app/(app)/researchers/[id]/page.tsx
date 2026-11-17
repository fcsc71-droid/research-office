import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, PenLine, Trash2, Mail, Phone, IdCard, FileText, CheckCircle2, Users, BookOpen, Presentation, FolderKanban, Award as AwardIcon, BellRing, ExternalLink } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentsFor } from "@/lib/attachments";
import { deleteResearcherAction, requestProfileUpdateAction } from "@/actions/researchers";
import {
  DEGREE_LABELS, RESEARCHER_TYPE_LABELS, TYPE_LABELS, INDEXING_LABELS, EVENT_TYPE_LABELS, PARTICIPATION_ROLE_LABELS,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, AWARD_TYPE_LABELS, EVENT_SCOPE_LABELS,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { AttachmentList } from "@/components/app/attachment-list";
import { InfoRow, PageHeader, StatusBadge, EmptyState, StatCard, Field } from "@/components/app/misc";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "الملف البحثي" };

function Ext({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline" dir="ltr">{label} <ExternalLink className="size-3" /></a>;
}

export default async function ResearcherPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("researchers.view");
  const { id } = await params;
  const r = await db.researcher.findUnique({
    where: { id },
    include: {
      college: true, department: true, user: { select: { email: true, isActive: true, lastLoginAt: true } },
      authorships: {
        include: { paper: { select: { id: true, referenceNo: true, titleAr: true, status: true, type: true, submittedAt: true, publicationYear: true, indexing: true, journalName: true, journal: { select: { name: true } } } } },
        orderBy: { paper: { createdAt: "desc" } },
      },
      projectsLed: { select: { id: true, title: true, status: true, startDate: true } },
      projectMemberships: { include: { project: { select: { id: true, title: true, status: true, startDate: true } } } },
      eventParticipations: { include: { event: true }, orderBy: { event: { startDate: "desc" } } },
      awards: { orderBy: { date: "desc" } },
    },
  });
  if (!r) notFound();
  // رئيس القسم يرى باحثي قسمه فقط
  if (!can(user, "research.view_all") && can(user, "research.view_department") && r.departmentId !== user.departmentId && r.userId !== user.id) notFound();
  const cvs = (await attachmentsFor("RESEARCHER_CV", [r.id])).get(r.id);
  const main = r.authorships.filter((a) => a.role === "MAIN");
  const co = r.authorships.filter((a) => a.role === "CO_AUTHOR");
  const published = r.authorships.filter((a) => a.paper.status === "PUBLISHED");
  const indexed = r.authorships.filter((a) => ["SCOPUS", "WOS", "SCOPUS_WOS"].includes(a.paper.indexing));
  const projects = [
    ...r.projectsLed.map((p) => ({ ...p, role: "الباحث الرئيسي" })),
    ...r.projectMemberships.filter((m) => !r.projectsLed.some((p) => p.id === m.project.id)).map((m) => ({ ...m.project, role: m.role || "عضو فريق" })),
  ];
  const conferences = r.eventParticipations.filter((p) => p.event.type === "CONFERENCE");
  const workshops = r.eventParticipations.filter((p) => p.event.type !== "CONFERENCE");

  return (
    <div className="grid gap-5">
      <PageHeader icon={<GraduationCap />} title={r.fullName} description={`${r.jobTitle ?? RESEARCHER_TYPE_LABELS[r.type]} — ${DEGREE_LABELS[r.academicDegree]}`}
        actions={can(user, "researchers.manage") && (
          <>
            <Button asChild variant="outline"><Link href={`/researchers/${r.id}/edit`}><PenLine /> تعديل</Link></Button>
            {r.userId && (
              <FormDialog trigger={<Button variant="outline"><BellRing /> طلب تحديث البيانات</Button>} title="طلب تحديث البيانات" description="سيصل إشعار لعضو هيئة التدريس لاستكمال ملفه البحثي" action={requestProfileUpdateAction.bind(null, r.id)} submitText="إرسال الطلب">
                <Field label="الرسالة"><Textarea name="message" rows={3} defaultValue="يرجى استكمال بيانات ملفك البحثي (المعرفات العلمية، الاهتمامات البحثية، السيرة الذاتية) وإضافة أبحاثك المنشورة." /></Field>
              </FormDialog>
            )}
            <ConfirmButton action={deleteResearcherAction.bind(null, r.id)} title="حذف الباحث" description="لا يمكن حذف باحث مرتبط بأبحاث رئيسية." confirmText="حذف" variant="outline" size="default" className="text-destructive"><Trash2 /> حذف</ConfirmButton>
          </>
        )} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="أبحاث رئيسية" value={main.length} icon={<FileText />} />
        <StatCard label="مشاركات بحثية" value={co.length} icon={<Users />} tone="blue" />
        <StatCard label="منشورة" value={published.length} icon={<BookOpen />} tone="teal" />
        <StatCard label="Scopus / WoS" value={indexed.length} icon={<CheckCircle2 />} tone="green" />
        <StatCard label="مؤتمرات وفعاليات" value={r.eventParticipations.length} icon={<Presentation />} tone="indigo" />
        <StatCard label="مشاريع / جوائز" value={`${projects.length} / ${r.awards.length}`} icon={<AwardIcon />} tone="amber" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle>البيانات الشخصية والوظيفية</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="الرقم الجامعي"><span className="flex items-center gap-1 font-mono"><IdCard className="size-3" /> {r.universityId}</span></InfoRow>
                <InfoRow label="البريد"><span dir="ltr" className="flex items-center gap-1"><Mail className="size-3" /> {r.email}</span></InfoRow>
                <InfoRow label="الهاتف"><span dir="ltr" className="flex items-center gap-1"><Phone className="size-3" /> {r.phone ?? "—"}</span></InfoRow>
                <InfoRow label="القسم">{r.department?.name}</InfoRow>
                <InfoRow label="المسمى الوظيفي">{r.jobTitle}</InfoRow>
                <InfoRow label="الدرجة العلمية">{DEGREE_LABELS[r.academicDegree]}</InfoRow>
                <InfoRow label="المؤهل العلمي">{r.qualification}{r.qualificationYear ? ` (${r.qualificationYear})` : ""}</InfoRow>
                <InfoRow label="التخصص العام">{r.generalSpecialization}</InfoRow>
                <InfoRow label="التخصص الدقيق">{r.specialization}</InfoRow>
                <InfoRow label="حساب الدخول">{r.user ? <Badge variant={r.user.isActive ? "success" : "outline"}>{r.user.isActive ? "مفعّل" : "معطل"}</Badge> : "لا يوجد"}</InfoRow>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>المعرفات العلمية والاهتمامات</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <dl>
                <InfoRow label="ORCID">{r.orcid ? <Ext href={`https://orcid.org/${r.orcid}`} label={r.orcid} /> : null}</InfoRow>
                <InfoRow label="Scopus ID">{r.scopusId ? <Ext href={`https://www.scopus.com/authid/detail.uri?authorId=${r.scopusId}`} label={r.scopusId} /> : null}</InfoRow>
                <InfoRow label="Google Scholar">{r.googleScholar ? <Ext href={r.googleScholar} label="فتح الملف" /> : null}</InfoRow>
                <InfoRow label="ResearchGate">{r.researchGate ? <Ext href={r.researchGate} label="فتح الملف" /> : null}</InfoRow>
              </dl>
              <div className="flex flex-wrap gap-1">{r.researchInterests.length ? r.researchInterests.map((k) => <Link key={k} href={`/researchers?interest=${encodeURIComponent(k)}`}><Badge variant="secondary">{k}</Badge></Link>) : <span className="text-sm text-muted-foreground">لم تُحدد اهتمامات بحثية</span>}</div>
              <div><p className="mb-1 text-sm font-bold text-muted-foreground">السيرة الذاتية</p>{cvs?.length ? <AttachmentList items={cvs} /> : <span className="text-sm text-muted-foreground">غير مرفوعة</span>}</div>
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>الأبحاث المنشورة والمشاركات البحثية</CardTitle></CardHeader>
            {r.authorships.length === 0 ? <EmptyState title="لا توجد أبحاث مسجلة" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>البحث</TableHead><TableHead>الصفة</TableHead><TableHead>المجلة / الفهرسة</TableHead><TableHead>السنة</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.authorships.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/research/${a.paper.id}`} className="font-semibold text-navy hover:underline">{a.paper.titleAr}</Link>
                        <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[a.paper.type]}</p>
                      </TableCell>
                      <TableCell><Badge variant={a.role === "MAIN" ? "default" : "secondary"}>{a.role === "MAIN" ? "رئيسي" : "مشارك"}</Badge></TableCell>
                      <TableCell className="text-xs">{a.paper.journal?.name ?? a.paper.journalName ?? "—"}<br /><span className="text-muted-foreground">{INDEXING_LABELS[a.paper.indexing]}</span></TableCell>
                      <TableCell className="text-xs">{a.paper.publicationYear ?? formatDate(a.paper.submittedAt)}</TableCell>
                      <TableCell><StatusBadge status={a.paper.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Presentation className="size-4 text-brand" /> المؤتمرات</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {conferences.length === 0 && <p className="text-muted-foreground">لا توجد مشاركات</p>}
                {conferences.map((p) => (
                  <div key={p.id} className="rounded-md border p-2">
                    <p className="font-semibold">{p.event.name}</p>
                    <p className="text-xs text-muted-foreground">{EVENT_SCOPE_LABELS[p.event.scope]} · {PARTICIPATION_ROLE_LABELS[p.role]} · {formatDate(p.event.startDate)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Presentation className="size-4 text-brand" /> الدورات وورش العمل والندوات</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {workshops.length === 0 && <p className="text-muted-foreground">لا توجد مشاركات</p>}
                {workshops.map((p) => (
                  <div key={p.id} className="rounded-md border p-2">
                    <p className="font-semibold">{p.event.name}</p>
                    <p className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[p.event.type]} · {PARTICIPATION_ROLE_LABELS[p.role]} · {formatDate(p.event.startDate)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban className="size-4 text-brand" /> المشاريع البحثية</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {projects.length === 0 && <p className="text-muted-foreground">لا توجد مشاريع</p>}
                {projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-2 rounded-md border p-2 hover:bg-accent/40">
                    <span><span className="font-semibold">{p.title}</span><span className="block text-xs text-muted-foreground">{p.role}</span></span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", PROJECT_STATUS_COLORS[p.status])}>{PROJECT_STATUS_LABELS[p.status]}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AwardIcon className="size-4 text-brand" /> الجوائز العلمية</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {r.awards.length === 0 && <p className="text-muted-foreground">لا توجد جوائز</p>}
                {r.awards.map((w) => (
                  <div key={w.id} className="rounded-md border p-2">
                    <p className="font-semibold">{w.title}</p>
                    <p className="text-xs text-muted-foreground">{AWARD_TYPE_LABELS[w.type]} · {w.grantor ?? ""} · {formatDate(w.date)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
