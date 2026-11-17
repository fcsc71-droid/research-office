import Link from "next/link";
import { Sparkles, FileText, FolderKanban, Presentation, Award, UserCircle, AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownPapersWhere } from "@/lib/access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/misc";

export const metadata = { title: "إنتاجي العلمي" };

export default async function MyRecordsPage() {
  const user = await requirePermission("records.submit_own");
  const rid = user.researcherId ?? "__none__";
  const [papers, projects, events, awards, returned, me] = await Promise.all([
    db.researchPaper.count({ where: ownPapersWhere(user) }),
    db.researchProject.count({ where: { OR: [{ leadId: rid }, { members: { some: { researcherId: rid } } }] } }),
    db.eventParticipant.count({ where: { researcherId: rid } }),
    db.award.count({ where: { researcherId: rid } }),
    Promise.all([
      db.researchProject.count({ where: { leadId: rid, approval: "RETURNED" } }),
      db.scientificEvent.count({ where: { createdById: user.id, approval: "RETURNED" } }),
      db.award.count({ where: { researcherId: rid, approval: "RETURNED" } }),
      db.researchPaper.count({ where: { ...ownPapersWhere(user), status: "NEEDS_REVISION" } }),
    ]).then((x) => x.reduce((a, b) => a + b, 0)),
    db.researcher.findUnique({ where: { id: rid }, select: { orcid: true, scopusId: true, googleScholar: true, researchInterests: true } }),
  ]);
  const missing = me && !me.orcid && !me.scopusId && !me.googleScholar;
  const items = [
    { href: "/research", add: "/research/new", icon: FileText, label: "البحوث والمنشورات", count: papers, hint: "وثّق أبحاثك المنشورة (المجلة، DOI، الرابط) أو قدّم بحثاً جديداً للتحكيم" },
    { href: "/projects", icon: FolderKanban, label: "المشاريع البحثية", count: projects, hint: "سجّل مقترحاتك ومشاريعك وتقارير الإنجاز الدورية" },
    { href: "/events", icon: Presentation, label: "المؤتمرات والندوات والورش", count: events, hint: "وثّق مشاركاتك مع شهادات المشاركة" },
    { href: "/awards", icon: Award, label: "الجوائز والتكريم", count: awards, hint: "أضف جوائزك وبراءات الاختراع وشهادات التميز" },
  ];
  return (
    <div className="grid gap-5">
      <PageHeader icon={<Sparkles />} title="إنتاجي العلمي" description="أضف إنتاجك العلمي ليُراجع ويُعتمد من مكتب البحث العلمي ويظهر في ملفك البحثي وتقارير المعهد" />
      {(returned > 0 || missing) && (
        <div className="grid gap-2">
          {returned > 0 && <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-900"><AlertTriangle className="size-4" /> لديك {returned} سجل أعيد لاستكمال البيانات — راجع الملاحظات وعدّل السجل.</div>}
          {missing && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><UserCircle className="size-4" /> ملفك البحثي ينقصه المعرفات العلمية (ORCID / Scopus / Google Scholar). <Link href="/profile" className="font-bold underline">استكملها الآن</Link></div>}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.href}>
            <CardContent className="flex items-start gap-4 pt-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><i.icon className="size-6" /></div>
              <div className="flex-1">
                <p className="text-lg font-extrabold text-navy">{i.label} <span className="text-brand">({i.count})</span></p>
                <p className="text-sm text-muted-foreground">{i.hint}</p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm"><Link href={i.add ?? i.href}>{i.add ? "إضافة" : "عرض وإضافة"}</Link></Button>
                  {i.add && <Button asChild size="sm" variant="outline"><Link href={i.href}>عرض</Link></Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
