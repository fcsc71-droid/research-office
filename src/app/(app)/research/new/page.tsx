import { FilePlus2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createPaperAction } from "@/actions/research";
import { PageHeader } from "@/components/app/misc";
import { ResearchForm } from "@/components/app/research-form";
import { db } from "@/lib/db";
import { createOwnResearcherProfileAction } from "@/actions/researchers";
import { ActionForm, FieldError } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { Field } from "@/components/app/misc";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DEGREE_LABELS } from "@/lib/constants";

export const metadata = { title: "إضافة بحث جديد" };

export default async function NewResearchPage() {
  const user = await requirePermission("research.create");
  const staff = can(user, "research.view_all");
  const settings = await getSettings();
  if (!staff && !user.researcherId) {
    const departments = await db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    const student = user.roleKey === "STUDENT";
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader icon={<FilePlus2 />} title="تقديم بحث" description="خطوة واحدة قبل تقديم بحثك الأول" />
        <ActionForm action={createOwnResearcherProfileAction} className="grid gap-4 rounded-xl border bg-card p-6">
          <p className="text-sm">لإضافة بحثك نحتاج إنشاء ملفك كباحث. سيُستخدم اسمك وبريدك من حسابك: <b>{user.name}</b></p>
          <Field label={student ? "الرقم الجامعي" : "الرقم الوظيفي"} required><Input name="universityId" required dir="ltr" className="text-left" /><FieldError name="universityId" /></Field>
          <Field label="القسم العلمي" required>
            <NativeSelect name="departmentId" required defaultValue=""><option value="">— اختر —</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect>
            <FieldError name="departmentId" />
          </Field>
          <Field label="المرحلة / الدرجة العلمية" required>
            <NativeSelect name="academicDegree" defaultValue={student ? "BACHELOR_STUDENT" : "LECTURER"}>
              {Object.entries(DEGREE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Field>
          <SubmitButton className="w-fit">متابعة لتقديم البحث</SubmitButton>
        </ActionForm>
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
