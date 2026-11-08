import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, PenLine, Trash2, Mail, Phone, IdCard } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteResearcherAction } from "@/actions/researchers";
import { DEGREE_LABELS, RESEARCHER_TYPE_LABELS, TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/app/confirm-button";
import { InfoRow, PageHeader, StatusBadge, EmptyState, StatCard } from "@/components/app/misc";
import { formatDate } from "@/lib/utils";
import { FileText, CheckCircle2, Users, BookOpen } from "lucide-react";

export const metadata = { title: "ملف الباحث" };

export default async function ResearcherPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("researchers.view");
  const { id } = await params;
  const r = await db.researcher.findUnique({
    where: { id },
    include: {
      college: true, department: true, user: { select: { email: true, isActive: true, lastLoginAt: true } },
      authorships: {
        include: { paper: { select: { id: true, referenceNo: true, titleAr: true, status: true, type: true, submittedAt: true, createdAt: true } } },
        orderBy: { paper: { createdAt: "desc" } },
      },
    },
  });
  if (!r) notFound();
  const main = r.authorships.filter((a) => a.role === "MAIN");
  const co = r.authorships.filter((a) => a.role === "CO_AUTHOR");
  const accepted = r.authorships.filter((a) => ["ACCEPTED", "PUBLISHED"].includes(a.paper.status)).length;
  const published = r.authorships.filter((a) => a.paper.status === "PUBLISHED").length;

  return (
    <div className="grid gap-5">
      <PageHeader icon={<GraduationCap />} title={r.fullName} description={`${DEGREE_LABELS[r.academicDegree]} — ${RESEARCHER_TYPE_LABELS[r.type]}`}
        actions={can(user, "researchers.manage") && (
          <>
            <Button asChild variant="outline"><Link href={`/researchers/${r.id}/edit`}><PenLine /> تعديل</Link></Button>
            <ConfirmButton action={deleteResearcherAction.bind(null, r.id)} title="حذف الباحث" description="سيتم حذف ملف الباحث. لا يمكن حذف باحث مرتبط بأبحاث رئيسية." confirmText="حذف" variant="outline" size="default" className="text-destructive"><Trash2 /> حذف</ConfirmButton>
          </>
        )} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="أبحاث كباحث رئيسي" value={main.length} icon={<FileText />} />
        <StatCard label="مشاركات بحثية" value={co.length} icon={<Users />} tone="blue" />
        <StatCard label="أبحاث مقبولة" value={accepted} icon={<CheckCircle2 />} tone="green" />
        <StatCard label="أبحاث منشورة" value={published} icon={<BookOpen />} tone="teal" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>البيانات الشخصية</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="الرقم الجامعي"><span className="flex items-center gap-1 font-mono"><IdCard className="size-3" /> {r.universityId}</span></InfoRow>
              <InfoRow label="البريد"><span dir="ltr" className="flex items-center gap-1"><Mail className="size-3" /> {r.email}</span></InfoRow>
              <InfoRow label="الهاتف"><span dir="ltr" className="flex items-center gap-1"><Phone className="size-3" /> {r.phone ?? "—"}</span></InfoRow>
              <InfoRow label="الكلية">{r.college?.name}</InfoRow>
              <InfoRow label="القسم">{r.department?.name}</InfoRow>
              <InfoRow label="التخصص">{r.specialization}</InfoRow>
              <InfoRow label="الدرجة العلمية">{DEGREE_LABELS[r.academicDegree]}</InfoRow>
              <InfoRow label="حساب الدخول">{r.user ? <><Badge variant={r.user.isActive ? "success" : "outline"}>{r.user.isActive ? "مفعّل" : "معطل"}</Badge> <span className="text-xs text-muted-foreground">آخر دخول: {formatDate(r.user.lastLoginAt)}</span></> : "لا يوجد"}</InfoRow>
              {r.notes && <InfoRow label="ملاحظات">{r.notes}</InfoRow>}
            </dl>
          </CardContent>
        </Card>
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader><CardTitle>سجل المشاركات البحثية</CardTitle></CardHeader>
          {r.authorships.length === 0 ? <EmptyState title="لا توجد أبحاث مسجلة لهذا الباحث" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>البحث</TableHead><TableHead>الصفة</TableHead><TableHead>النوع</TableHead><TableHead>التقديم</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.authorships.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {can(user, "research.view_all") ? <Link href={`/research/${a.paper.id}`} className="font-semibold text-navy hover:underline">{a.paper.titleAr}</Link> : <span className="font-semibold">{a.paper.titleAr}</span>}
                      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{a.paper.referenceNo}</p>
                    </TableCell>
                    <TableCell><Badge variant={a.role === "MAIN" ? "default" : "secondary"}>{a.role === "MAIN" ? "رئيسي" : "مشارك"}</Badge></TableCell>
                    <TableCell className="text-xs">{TYPE_LABELS[a.paper.type]}</TableCell>
                    <TableCell className="text-xs">{formatDate(a.paper.submittedAt)}</TableCell>
                    <TableCell><StatusBadge status={a.paper.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
