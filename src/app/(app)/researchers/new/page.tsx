import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { saveResearcherAction } from "@/actions/researchers";
import { PageHeader } from "@/components/app/misc";
import { ResearcherForm } from "@/components/app/researcher-form";

export const metadata = { title: "إضافة باحث" };

export default async function NewResearcherPage() {
  await requirePermission("researchers.manage");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={<UserPlus />} title="إضافة باحث / طالب" description="إنشاء ملف مستقل للباحث" />
      <ResearcherForm action={saveResearcherAction.bind(null, null)} />
    </div>
  );
}
