import { FileSpreadsheet, Download } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/misc";
import { ImportForm } from "@/components/app/import-form";
import { TEMPLATES } from "@/lib/import";

export const metadata = { title: "استيراد البيانات من Excel" };

export default async function ImportPage() {
  const user = await requirePermission("researchers.manage", "research.edit_all");
  const blocks = [
    { type: "researchers" as const, perm: can(user, "researchers.manage"), step: "الخطوة 1", desc: "قائمة أعضاء هيئة التدريس من كل قسم (البيانات الأكاديمية والمعرفات العلمية والاهتمامات البحثية). يتم تجاوز المسجلين مسبقاً تلقائياً." },
    { type: "papers" as const, perm: can(user, "research.edit_all"), step: "الخطوة 2", desc: "البحوث المنشورة خلال آخر 5 سنوات. تُسجَّل «بانتظار الاعتماد» ما لم يُختر الاعتماد المباشر، ويُتجاوز أي بحث مكرر (نفس DOI أو عنوان مشابه)." },
  ];
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader icon={<FileSpreadsheet />} title="استيراد البيانات من Excel" description="جمع البيانات الحقيقية من الأقسام العلمية عبر نماذج Excel موحدة، بدلاً من إدخالها يدوياً سجلاً سجلاً" />
      {blocks.filter((b) => b.perm).map((b) => (
        <Card key={b.type}>
          <CardHeader>
            <CardTitle>{b.step}: {TEMPLATES[b.type].title}</CardTitle>
            <CardDescription>{b.desc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button asChild variant="outline"><a href={`/api/import/template?type=${b.type}`}><Download /> تنزيل القالب</a></Button>
              <span className="text-muted-foreground">الأعمدة المعلمة بـ * إلزامية. لا تغيّر ترتيب الأعمدة.</span>
            </div>
            <ImportForm type={b.type} canApprove={can(user, "research.approve")} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
