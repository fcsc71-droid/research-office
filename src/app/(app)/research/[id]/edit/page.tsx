import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPaperAccess } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { updatePaperAction } from "@/actions/research";
import { PageHeader } from "@/components/app/misc";
import { ResearchForm } from "@/components/app/research-form";

export const metadata = { title: "تعديل بحث" };

export default async function EditResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const paper = await db.researchPaper.findUnique({ where: { id }, include: { authors: { orderBy: { order: "asc" } } } });
  if (!paper) notFound();
  const access = await getPaperAccess(user, paper);
  if (!access.canEditMeta) notFound();
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={<PenLine />} title="تعديل بيانات البحث" description={<span dir="ltr" className="font-mono">{paper.referenceNo}</span>} />
      <ResearchForm action={updatePaperAction.bind(null, paper.id)} paper={paper} staff={can(user, "research.view_all")} ownResearcherId={user.researcherId} maxUploadMb={settings.maxUploadMb} />
    </div>
  );
}
