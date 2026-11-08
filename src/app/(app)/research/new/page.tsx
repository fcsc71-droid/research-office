import { FilePlus2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createPaperAction } from "@/actions/research";
import { PageHeader } from "@/components/app/misc";
import { ResearchForm } from "@/components/app/research-form";

export const metadata = { title: "إضافة بحث جديد" };

export default async function NewResearchPage() {
  const user = await requirePermission("research.create");
  const staff = can(user, "research.view_all");
  const settings = await getSettings();
  if (!staff && !user.researcherId) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="font-bold text-navy">حسابك غير مرتبط بملف باحث</p>
        <p className="mt-1 text-sm text-muted-foreground">يرجى التواصل مع مكتب الأبحاث لربط حسابك بملف الباحث الخاص بك قبل تقديم الأبحاث.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={<FilePlus2 />} title="إضافة بحث جديد" description="أدخل بيانات البحث وأرفق الملف. سيتم توليد الرقم المرجعي تلقائياً." />
      <ResearchForm action={createPaperAction} staff={staff} ownResearcherId={user.researcherId} maxUploadMb={settings.maxUploadMb} />
    </div>
  );
}
