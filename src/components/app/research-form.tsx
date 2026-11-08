import { db } from "@/lib/db";
import { ActionForm, FieldError } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { CollegeDepartmentSelect, MultiPicker, SinglePicker } from "@/components/app/pickers";
import { Field } from "@/components/app/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { LEVEL_LABELS, TYPE_LABELS, FILE_ACCEPT_ATTR } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";
import type { ResearchPaper, ResearchAuthor } from "@/generated/prisma/client";

export async function ResearchForm({
  action,
  paper,
  staff,
  ownResearcherId,
  maxUploadMb,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  paper?: ResearchPaper & { authors: ResearchAuthor[] };
  staff: boolean;
  ownResearcherId?: string | null;
  maxUploadMb: number;
}) {
  const [colleges, departments, categories, researchers] = await Promise.all([
    db.college.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, collegeId: true } }),
    db.researchCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.researcher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, universityId: true, collegeId: true, departmentId: true } }),
  ]);
  const opts = researchers.map((r) => ({ id: r.id, name: r.fullName, sub: r.universityId }));
  const own = researchers.find((r) => r.id === ownResearcherId);
  const coAuthors = paper?.authors.filter((a) => a.role === "CO_AUTHOR" && a.researcherId).map((a) => a.researcherId!) ?? [];
  const external = paper?.authors.filter((a) => a.role === "CO_AUTHOR" && !a.researcherId).map((a) => a.name).join("\n") ?? "";

  return (
    <ActionForm action={action} className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>البيانات الأساسية للبحث</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="عنوان البحث بالعربية" required className="md:col-span-2">
            <Input name="titleAr" defaultValue={paper?.titleAr} required minLength={5} maxLength={500} />
            <FieldError name="titleAr" />
          </Field>
          <Field label="عنوان البحث بالإنجليزية" className="md:col-span-2">
            <Input name="titleEn" defaultValue={paper?.titleEn ?? ""} dir="ltr" className="text-left" maxLength={500} />
          </Field>
          <Field label="الملخص" required className="md:col-span-2">
            <Textarea name="abstract" defaultValue={paper?.abstract} rows={6} required minLength={20} maxLength={8000} />
            <FieldError name="abstract" />
          </Field>
          <Field label="الكلمات المفتاحية" hint="افصل بين الكلمات بفاصلة" className="md:col-span-2">
            <Input name="keywords" defaultValue={paper?.keywords.join("، ")} placeholder="مثال: الذكاء الاصطناعي، التعلم العميق" />
          </Field>
          <Field label="نوع البحث" required>
            <NativeSelect name="type" defaultValue={paper?.type ?? ""} required>
              <option value="">— اختر —</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <FieldError name="type" />
          </Field>
          <Field label="مستوى البحث" required>
            <NativeSelect name="level" defaultValue={paper?.level ?? ""} required>
              <option value="">— اختر —</option>
              {Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <FieldError name="level" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الباحثون والإشراف</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="الباحث الرئيسي" required>
            {staff ? (
              <>
                <SinglePicker name="mainResearcherId" options={opts} defaultValue={paper?.mainResearcherId} />
                <FieldError name="mainResearcherId" />
              </>
            ) : (
              <div className="rounded-md border bg-muted px-3 py-2 text-sm">{own?.fullName ?? "—"}</div>
            )}
          </Field>
          <Field label="الباحثون المشاركون (من سجل الباحثين)">
            <MultiPicker name="coAuthors" options={opts} defaultValues={coAuthors} exclude={paper?.mainResearcherId ?? ownResearcherId ?? undefined} />
          </Field>
          <Field label="باحثون مشاركون من خارج السجل" hint="اسم واحد في كل سطر">
            <Textarea name="externalAuthors" defaultValue={external} rows={3} />
          </Field>
          <Field label="اسم المشرف">
            <Input name="supervisorName" defaultValue={paper?.supervisorName ?? ""} maxLength={200} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>التصنيف الأكاديمي</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <CollegeDepartmentSelect
            colleges={colleges}
            departments={departments}
            defaultCollegeId={paper?.collegeId ?? own?.collegeId}
            defaultDepartmentId={paper?.departmentId ?? own?.departmentId}
          />
          <Field label="التصنيف / مجال التخصص">
            <NativeSelect name="categoryId" defaultValue={paper?.categoryId ?? ""}>
              <option value="">— بدون —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="التخصص الدقيق">
            <Input name="specialization" defaultValue={paper?.specialization ?? ""} maxLength={200} />
          </Field>
          {staff && (
            <Field label="تاريخ تقديم البحث" hint="يُسجَّل تلقائياً عند التقديم، ويمكن للموظف تعديله للأبحاث الورقية">
              <Input type="date" name="submittedAt" defaultValue={toInputDate(paper?.submittedAt)} />
            </Field>
          )}
        </CardContent>
      </Card>

      {!paper && (
        <Card>
          <CardHeader><CardTitle>ملف البحث والتقديم</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="ملف البحث الرئيسي" hint={`الأنواع المسموحة: PDF, DOCX, DOC, XLSX, PPTX, الصور — الحد الأقصى ${maxUploadMb} م.ب. يمكن إضافة مرفقات أخرى من صفحة البحث.`}>
              <Input type="file" name="mainFile" accept={FILE_ACCEPT_ATTR} className="h-auto py-2" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Checkbox name="submitNow" defaultChecked={!staff} />
              تقديم البحث مباشرة (بدلاً من حفظه كمسودة) — يتطلب إرفاق ملف البحث
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <SubmitButton size="lg">{paper ? "حفظ التعديلات" : "حفظ البحث"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
