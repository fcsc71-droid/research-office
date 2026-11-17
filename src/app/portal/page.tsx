import Link from "next/link";
import { BookOpen, Users, Presentation, FolderKanban, LogIn, ExternalLink, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { APP_NAME, INSTITUTE_NAME, INSTITUTE_NAME_EN, LOGO_PATH, INDEXING_LABELS, EVENT_TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "البوابة العامة للبحث العلمي" };
export const dynamic = "force-dynamic";

/**
 * المستوى العام من المعلومات (وفق سياسة مستويات المعلومات):
 * أسماء البحوث المنشورة وروابطها والأنشطة العلمية المعتمدة فقط — دون أي بيانات شخصية أو ملفات.
 */
export default async function PortalPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const settings = await getSettings();
  const pubWhere = {
    OR: [{ status: "PUBLISHED" as const }, { status: "ARCHIVED" as const, publishedAt: { not: null } }],
    ...(q ? { AND: [{ OR: [{ titleAr: { contains: q.slice(0, 100), mode: "insensitive" as const } }, { titleEn: { contains: q.slice(0, 100), mode: "insensitive" as const } }, { keywords: { has: q } }] }] } : {}),
  };
  const [papers, pubCount, researchers, projects, activities] = await Promise.all([
    db.researchPaper.findMany({
      where: pubWhere, orderBy: [{ publicationYear: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }], take: 20,
      select: { id: true, titleAr: true, titleEn: true, publicationYear: true, publishedAt: true, doi: true, url: true, indexing: true, journalName: true, journal: { select: { name: true } }, department: { select: { name: true } }, authors: { select: { name: true }, orderBy: { order: "asc" } } },
    }),
    db.researchPaper.count({ where: { OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED", publishedAt: { not: null } }] } }),
    db.researcher.count({ where: { type: "FACULTY" } }),
    db.researchProject.count({ where: { approval: "APPROVED", status: { in: ["APPROVED", "IN_PROGRESS"] } } }),
    db.scientificEvent.findMany({ where: { organizedByInstitute: true, approval: "APPROVED" }, orderBy: { startDate: "desc" }, take: 8, select: { id: true, name: true, type: true, startDate: true, location: true } }),
  ]);
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:text-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_PATH} alt="شعار المعهد العالي للتقنيات الهندسية – بنغازي" className="size-24 rounded-full bg-white p-1 shadow-lg" />
          <div className="flex-1">
            <p className="text-xl font-extrabold">{settings.universityName || INSTITUTE_NAME}</p>
            <p className="text-xs text-white/60" dir="ltr">{INSTITUTE_NAME_EN}</p>
            <p className="mt-1 text-sm text-sky-200">{settings.officeName} — {APP_NAME}</p>
          </div>
          <Button asChild variant="secondary"><Link href="/login"><LogIn /> تسجيل الدخول</Link></Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[[BookOpen, "بحث منشور", pubCount], [Users, "عضو هيئة تدريس", researchers], [FolderKanban, "مشروع بحثي نشط", projects], [Presentation, "نشاط علمي", activities.length]].map(([Icon, label, v], i) => {
            const I = Icon as typeof BookOpen;
            return (
              <Card key={i}><CardContent className="flex items-center gap-3 pt-5"><I className="size-8 text-brand" /><div><p className="text-2xl font-extrabold text-navy">{v as number}</p><p className="text-xs text-muted-foreground">{label as string}</p></div></CardContent></Card>
            );
          })}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>البحوث المنشورة</CardTitle>
              <form className="relative mt-2" action="/portal">
                <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={q} placeholder="ابحث في عناوين البحوث والكلمات المفتاحية..." className="pe-9" />
              </form>
            </CardHeader>
            <CardContent className="grid gap-3">
              {papers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج</p>}
              {papers.map((p) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <p className="font-bold text-navy">{p.titleAr}</p>
                  {p.titleEn && <p className="text-xs text-muted-foreground" dir="ltr">{p.titleEn}</p>}
                  <p className="mt-1 text-xs">{p.authors.map((a) => a.name).join("، ")}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{p.journal?.name ?? p.journalName ?? p.department?.name}</span>
                    <span>· {p.publicationYear ?? formatDate(p.publishedAt)}</span>
                    {p.indexing !== "NONE" && <Badge variant="success">{INDEXING_LABELS[p.indexing]}</Badge>}
                    {p.doi && <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline" dir="ltr">DOI <ExternalLink className="size-3" /></a>}
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">رابط البحث <ExternalLink className="size-3" /></a>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader><CardTitle>الأنشطة العلمية للمعهد</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {activities.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أنشطة</p>}
              {activities.map((a) => (
                <div key={a.id} className="rounded-lg border p-2.5 text-sm">
                  <p className="font-semibold text-navy">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[a.type]} · {formatDate(a.startDate)}{a.location ? ` · ${a.location}` : ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <p className="text-center text-xs text-muted-foreground">تعرض هذه البوابة المعلومات العامة فقط. البيانات الداخلية والشخصية متاحة لأصحاب الصلاحيات بعد تسجيل الدخول.</p>
      </main>
    </div>
  );
}
