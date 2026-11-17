import { Network, Download, Maximize2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/misc";

export const metadata = { title: "مخططات المنظومة" };

const DIAGRAMS = [
  { file: "use-case.png", title: "مخطط حالات الاستخدام", en: "Use Case Diagram", group: "التحليل",
    desc: "يوضح المستخدمين السبعة للمنظومة (عضو هيئة التدريس، الموظف، المدير، رئيس القسم، المحكم، مدير النظام، الطالب) وما يستطيع كل منهم القيام به." },
  { file: "context.png", title: "مخطط السياق", en: "Context Diagram", group: "التحليل",
    desc: "يعرض المنظومة كعملية واحدة وعلاقتها بالجهات الخارجية وتدفقات البيانات الداخلة إليها والخارجة منها." },
  { file: "dfd-level-0.png", title: "مخطط تدفق البيانات – المستوى صفر", en: "DFD Level 0", group: "التحليل",
    desc: "يوضح العمليات الرئيسية الست (الحسابات، الملفات البحثية، توثيق البحوث، التحكيم، المشاريع والأنشطة، التقارير) ومخازن البيانات الستة." },
  { file: "dfd-level-1.png", title: "مخطط تدفق البيانات – المستوى الأول", en: "DFD Level 1", group: "التحليل",
    desc: "تفصيل عملية «توثيق البحوث واعتمادها»: الإدخال، فحص الملفات وكشف التكرار، المراجعة الإدارية، الاعتماد أو الإرجاع، تحديث الملف البحثي." },
  { file: "workflow.png", title: "دورة حياة البحث", en: "Research Workflow (State Diagram)", group: "التصميم",
    desc: "حالات البحث العشر والانتقالات المسموحة بينها، من المسودة حتى النشر والأرشفة." },
  { file: "erd-core.png", title: "مخطط قاعدة البيانات – النواة", en: "ERD – Core", group: "قاعدة البيانات",
    desc: "الكيانات الأساسية وعلاقاتها: المستخدمون والأدوار والصلاحيات، الكليات والأقسام، الباحثون، البحوث، المجلات، التحكيم." },
  { file: "erd-modules.png", title: "مخطط قاعدة البيانات – وحدات الإنتاج العلمي", en: "ERD – Modules", group: "قاعدة البيانات",
    desc: "المشاريع البحثية وفرقها وتقاريرها، المؤتمرات والأنشطة والمشاركون، التعاون البحثي، الجوائز، والمرفقات." },
];

export default async function DiagramsPage() {
  await requireUser();
  return (
    <div className="grid gap-5">
      <PageHeader icon={<Network />} title="مخططات المنظومة" description="مخططات التحليل والتصميم وقاعدة البيانات الخاصة بمنظومة إدارة البحث العلمي" />
      <div className="no-print flex flex-wrap gap-2 text-sm">
        {DIAGRAMS.map((d, i) => (
          <a key={d.file} href={`#d${i}`} className="rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent">{i + 1}. {d.title}</a>
        ))}
      </div>
      {DIAGRAMS.map((d, i) => (
        <Card key={d.file} id={`d${i}`} className="scroll-mt-20 overflow-hidden">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {i + 1}. {d.title} <span dir="ltr" className="text-sm font-normal text-muted-foreground">({d.en})</span>
                <Badge variant="secondary">{d.group}</Badge>
              </CardTitle>
              <CardDescription className="mt-1 leading-7">{d.desc}</CardDescription>
            </div>
            <div className="no-print flex gap-2">
              <Button asChild variant="outline" size="sm"><a href={`/diagrams/${d.file}`} target="_blank" rel="noopener"><Maximize2 /> تكبير</a></Button>
              <Button asChild size="sm"><a href={`/diagrams/${d.file}`} download={`${d.en}.png`}><Download /> تنزيل</a></Button>
            </div>
          </CardHeader>
          <CardContent>
            <a href={`/diagrams/${d.file}`} target="_blank" rel="noopener" className="block overflow-x-auto rounded-lg border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/diagrams/${d.file}`} alt={d.title} loading="lazy" className="mx-auto max-h-[720px] w-auto max-w-full object-contain" />
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
