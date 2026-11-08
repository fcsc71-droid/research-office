import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveResearcherAction } from "@/actions/researchers";
import { PageHeader } from "@/components/app/misc";
import { ResearcherForm } from "@/components/app/researcher-form";

export const metadata = { title: "تعديل باحث" };

export default async function EditResearcherPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("researchers.manage");
  const { id } = await params;
  const r = await db.researcher.findUnique({ where: { id } });
  if (!r) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={<PenLine />} title="تعديل بيانات الباحث" description={r.fullName} />
      <ResearcherForm action={saveResearcherAction.bind(null, r.id)} r={r} />
    </div>
  );
}
