import Link from "next/link";
import {
  AlertCircle, Building2, CheckCircle2, ClipboardCheck, Clock, FilePlus2, FileText, GraduationCap, Hourglass,
  LayoutDashboard, PenLine, UserCheck, XCircle, Bell, Activity, FlaskConical, Presentation, FolderKanban, BadgeCheck, Award, Inbox,
} from "lucide-react";
import { requireUser, can, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownPapersWhere } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/app/misc";
import { MonthlyChart, CategoryChart, HorizontalBars } from "@/components/app/charts";
import { ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUS_LABELS } from "@/lib/constants";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { formatDate, relativeTime, cn } from "@/lib/utils";

export const metadata = { title: "لوحة التحكم" };

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default async function DashboardPage() {
  const user = await requireUser();
  return can(user, "dashboard.view") ? <AdminDashboard user={user} /> : <PersonalDashboard user={user} />;
}

async function NotificationsCard({ userId }: { userId: string }) {
  const items = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6 });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Bell className="size-4 text-brand" /> إشعارات النظام</CardTitle>
        <Link href="/notifications" className="text-xs font-semibold text-brand hover:underline">عرض الكل</Link>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</p>}
        {items.map((n) => (
          <Link key={n.id} href={n.link ?? "/notifications"} className={cn("rounded-lg border p-2.5 text-sm transition hover:bg-accent/50", !n.readAt && "border-brand/30 bg-brand-soft/30")}>
            <p className="font-semibold text-navy">{n.title}</p>
            {n.body && <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>}
            <p className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

async function AdminDashboard({ user }: { user: CurrentUser }) {
  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  since.setHours(0, 0, 0, 0);

  const [indexedCount, eventCount, activeProjects, awardsCount, pendingProjects, pendingEvents, pendingAwards, pubYears, deptRows] = await Promise.all([
    db.researchPaper.count({ where: { indexing: { in: ["SCOPUS", "WOS", "SCOPUS_WOS"] }, OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED", publishedAt: { not: null } }] } }),
    db.eventParticipant.count({ where: { event: { approval: "APPROVED", organizedByInstitute: false } } }),
    db.researchProject.count({ where: { approval: "APPROVED", status: { in: ["APPROVED", "IN_PROGRESS"] } } }),
    db.award.count({ where: { approval: "APPROVED" } }),
    db.researchProject.count({ where: { approval: "PENDING" } }),
    db.scientificEvent.count({ where: { approval: "PENDING" } }),
    db.award.count({ where: { approval: "PENDING" } }),
    db.researchPaper.findMany({ where: { OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED", publishedAt: { not: null } }] }, select: { publicationYear: true, publishedAt: true } }),
    db.department.findMany({ select: { name: true, _count: { select: { papers: { where: { status: "PUBLISHED" } } } } } }),
  ]);
  const yearMap = new Map<number, number>();
  for (const p of pubYears) { const y = p.publicationYear ?? p.publishedAt?.getFullYear(); if (y) yearMap.set(y, (yearMap.get(y) ?? 0) + 1); }
  const byYear = [...yearMap.entries()].sort((a, b) => a[0] - b[0]).slice(-8).map(([y, value]) => ({ name: String(y), value }));
  const byDept = deptRows.map((d) => ({ name: d.name, value: d._count.papers })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const pendingTotal = pendingProjects + pendingEvents + pendingAwards;

  const [byStatus, researchers, reviewers, departments, recent, activity, monthlyRaw, byCategory, demo] = await Promise.all([
    db.researchPaper.groupBy({ by: ["status"], _count: true }),
    db.researcher.count(),
    db.user.count({ where: { isActive: true, role: { key: "REVIEWER" } } }),
    db.department.count(),
    db.researchPaper.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { mainResearcher: { select: { fullName: true } }, department: { select: { name: true } } },
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } }),
    db.researchPaper.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, status: true } }),
    db.researchPaper.groupBy({ by: ["categoryId"], _count: true }),
    db.systemSetting.findUnique({ where: { key: "demoData" } }),
  ]);
  const count = (...s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((a, b) => a + b._count, 0);
  const total = byStatus.reduce((a, b) => a + b._count, 0);

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, submitted: 0, accepted: 0 };
  });
  for (const p of monthlyRaw) {
    const m = monthly.find((x) => x.key === `${p.createdAt.getFullYear()}-${p.createdAt.getMonth()}`);
    if (m) {
      m.submitted++;
      if (["ACCEPTED", "PUBLISHED"].includes(p.status)) m.accepted++;
    }
  }
  const cats = await db.researchCategory.findMany({ select: { id: true, name: true } });
  const categoryData = byCategory
    .map((c) => ({ name: cats.find((x) => x.id === c.categoryId)?.name ?? "غير مصنف", value: c._count }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={<LayoutDashboard />}
        title={`مرحباً، ${user.name}`}
        description="نظرة عامة على نشاط مكتب الأبحاث العلمية"
        actions={can(user, "research.create") && (
          <Button asChild><Link href="/research/new"><FilePlus2 /> إضافة بحث جديد</Link></Button>
        )}
      />
      {demo?.value === true && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertCircle className="size-4" /> تعرض هذه البيئة <b>بيانات تجريبية</b> لأغراض التطوير والاختبار فقط، وهي غير موجودة في بيئة الإنتاج.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="إجمالي الأبحاث" value={total} icon={<FileText />} tone="navy" href="/research" />
        <StatCard label="الأبحاث الجديدة" value={count("SUBMITTED")} icon={<FilePlus2 />} tone="blue" href="/research?status=SUBMITTED" />
        <StatCard label="قيد المراجعة والتحكيم" value={count("ADMIN_REVIEW", "UNDER_REVIEW", "RESUBMITTED")} icon={<Hourglass />} tone="indigo" href="/research?status=UNDER_REVIEW" />
        <StatCard label="تحتاج تعديلات" value={count("NEEDS_REVISION")} icon={<PenLine />} tone="amber" href="/research?status=NEEDS_REVISION" />
        <StatCard label="المقبولة والمنشورة" value={count("ACCEPTED", "PUBLISHED")} icon={<CheckCircle2 />} tone="green" href="/research?status=ACCEPTED" />
        <StatCard label="المرفوضة" value={count("REJECTED")} icon={<XCircle />} tone="red" href="/research?status=REJECTED" />
        <StatCard label="الباحثون" value={researchers} icon={<GraduationCap />} tone="teal" href={can(user, "researchers.view") ? "/researchers" : undefined} />
        <StatCard label="المحكمون" value={reviewers} icon={<UserCheck />} tone="slate" href={can(user, "reviewers.manage") ? "/reviewers" : undefined} />
        <StatCard label="الأقسام العلمية" value={departments} icon={<Building2 />} tone="blue" href={can(user, "structure.manage") ? "/structure" : undefined} />
        <StatCard label="المسودات" value={count("DRAFT")} icon={<Clock />} tone="slate" href="/research?status=DRAFT" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="بحوث في Scopus / WoS" value={indexedCount} icon={<BadgeCheck />} tone="green" href="/research?indexing=INDEXED" />
        <StatCard label="المشاركات في المؤتمرات والفعاليات" value={eventCount} icon={<Presentation />} tone="indigo" href="/events" />
        <StatCard label="المشاريع البحثية النشطة" value={activeProjects} icon={<FolderKanban />} tone="blue" href="/projects?status=IN_PROGRESS" />
        <StatCard label="الجوائز والتكريم" value={awardsCount} icon={<Award />} tone="amber" href="/awards" />
        <StatCard label="سجلات بانتظار الاعتماد" value={pendingTotal} icon={<Inbox />} tone={pendingTotal ? "red" : "slate"} href={pendingProjects ? "/projects?approval=PENDING" : pendingEvents ? "/events?approval=PENDING" : "/awards?approval=PENDING"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الإنتاج العلمي حسب السنة</CardTitle><CardDescription>البحوث المنشورة المعتمدة</CardDescription></CardHeader>
          <CardContent><HorizontalBars data={byYear} name="بحث منشور" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>توزيع البحوث حسب الأقسام</CardTitle><CardDescription>البحوث المنشورة لكل قسم علمي</CardDescription></CardHeader>
          <CardContent><HorizontalBars data={byDept} name="بحث منشور" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>الأبحاث حسب الأشهر</CardTitle>
            <CardDescription>آخر 12 شهراً</CardDescription>
          </CardHeader>
          <CardContent><MonthlyChart data={monthly} /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>الأبحاث حسب التخصص</CardTitle>
            <CardDescription>توزيع جميع الأبحاث على التخصصات</CardDescription>
          </CardHeader>
          <CardContent><CategoryChart data={categoryData} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FileText className="size-4 text-brand" /> آخر الأبحاث المضافة</CardTitle>
            <Link href="/research" className="text-xs font-semibold text-brand hover:underline">عرض الكل</Link>
          </CardHeader>
          <CardContent className="grid gap-2">
            {recent.length === 0 && <EmptyState title="لا توجد أبحاث بعد" />}
            {recent.map((p) => (
              <Link key={p.id} href={`/research/${p.id}`} className="flex flex-col gap-1 rounded-lg border p-3 transition hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{p.titleAr}</p>
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr" className="font-mono">{p.referenceNo}</span> · {p.mainResearcher.fullName} · {p.department?.name ?? "—"} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <NotificationsCard userId={user.id} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-brand" /> آخر الأنشطة</CardTitle>
          {can(user, "audit.view") && <Link href="/audit" className="text-xs font-semibold text-brand hover:underline">سجل العمليات</Link>}
        </CardHeader>
        <CardContent>
          <ol className="relative grid gap-3 border-r-2 border-brand-soft pr-4">
            {activity.map((a) => (
              <li key={a.id} className="relative text-sm">
                <span className="absolute top-1.5 -right-[23px] size-3 rounded-full border-2 border-white bg-brand" />
                <p><b className="text-navy">{a.user?.name ?? "النظام"}</b> — <span className="text-muted-foreground">{AUDIT_ACTION_LABELS[a.action] ?? a.action}:</span> {a.summary}</p>
                <p className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

async function PersonalDashboard({ user }: { user: CurrentUser }) {
  const isReviewer = can(user, "reviews.perform");
  const isResearcher = can(user, "research.create");
  const [papers, assignments] = await Promise.all([
    isResearcher
      ? db.researchPaper.findMany({ where: ownPapersWhere(user), orderBy: { updatedAt: "desc" }, take: 8 })
      : Promise.resolve([]),
    isReviewer
      ? db.reviewAssignment.findMany({
          where: { reviewerId: user.id, status: { not: "CANCELLED" } },
          orderBy: { dueDate: "asc" },
          include: { paper: { select: { titleAr: true, referenceNo: true } } },
          take: 8,
        })
      : Promise.resolve([]),
  ]);
  const c = (s: string[]) => papers.filter((p) => s.includes(p.status)).length;
  const pendingReviews = assignments.filter((a) => ["PENDING", "IN_PROGRESS"].includes(a.status));
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={<LayoutDashboard />}
        title={`مرحباً، ${user.name}`}
        description={user.roleName}
        actions={isResearcher && <Button asChild><Link href="/research/new"><FilePlus2 /> تقديم بحث جديد</Link></Button>}
      />
      {isResearcher && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="أبحاثي" value={papers.length} icon={<FileText />} tone="navy" href="/research" />
          <StatCard label="قيد المراجعة" value={c(["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "RESUBMITTED"])} icon={<Hourglass />} tone="indigo" />
          <StatCard label="تحتاج تعديلات" value={c(["NEEDS_REVISION"])} icon={<PenLine />} tone="amber" />
          <StatCard label="مقبولة / منشورة" value={c(["ACCEPTED", "PUBLISHED"])} icon={<CheckCircle2 />} tone="green" />
        </div>
      )}
      {isReviewer && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="تكليفات التحكيم" value={assignments.length} icon={<ClipboardCheck />} tone="navy" href="/reviews" />
          <StatCard label="بانتظار التقييم" value={pendingReviews.length} icon={<Hourglass />} tone="amber" href="/reviews" />
          <StatCard label="تم تسليمها" value={assignments.filter((a) => a.status === "SUBMITTED").length} icon={<CheckCircle2 />} tone="green" />
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid gap-4 xl:col-span-2">
          {isResearcher && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="size-4 text-brand" /> أبحاثي</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {papers.length === 0 && (
                  <EmptyState title="لم تقدم أي بحث بعد" description="ابدأ بتقديم بحثك الأول ومتابعة حالته من هنا" action={<Button asChild size="sm"><Link href="/research/new">تقديم بحث</Link></Button>} />
                )}
                {papers.map((p) => (
                  <Link key={p.id} href={`/research/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/40">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">{p.titleAr}</p>
                      <p className="text-xs text-muted-foreground"><span dir="ltr" className="font-mono">{p.referenceNo}</span> · آخر تحديث {relativeTime(p.updatedAt)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          {isReviewer && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-4 text-brand" /> تكليفات التحكيم</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {assignments.length === 0 && <EmptyState title="لا توجد تكليفات تحكيم حالياً" />}
                {assignments.map((a) => {
                  const late = ["PENDING", "IN_PROGRESS"].includes(a.status) && a.dueDate < new Date();
                  return (
                    <Link key={a.id} href={`/reviews/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/40">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy">{a.paper.titleAr}</p>
                        <p className={cn("text-xs", late ? "font-bold text-destructive" : "text-muted-foreground")}>موعد التسليم: {formatDate(a.dueDate)} {late && "(متأخر)"}</p>
                      </div>
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", ASSIGNMENT_STATUS_COLORS[a.status])}>{ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
        <NotificationsCard userId={user.id} />
      </div>
    </div>
  );
}
