import { db } from "@/lib/db";
import { ActionForm, FieldError } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { CollegeDepartmentSelect } from "@/components/app/pickers";
import { Field } from "@/components/app/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DEGREE_LABELS, RESEARCHER_TYPE_LABELS } from "@/lib/constants";
import type { ActionResult } from "@/lib/action";
import type { Researcher } from "@/generated/prisma/client";

export async function ResearcherForm({ action, r }: { action: (p: ActionResult | null, fd: FormData) => Promise<ActionResult>; r?: Researcher }) {
  const [colleges, departments] = await Promise.all([
    db.college.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, collegeId: true } }),
  ]);
  return (
    <ActionForm action={action}>
      <Card>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
          <Field label="الاسم الكامل" required><Input name="fullName" defaultValue={r?.fullName} required /><FieldError name="fullName" /></Field>
          <Field label="الرقم الجامعي أو الوظيفي" required><Input name="universityId" defaultValue={r?.universityId} required dir="ltr" className="text-left" /><FieldError name="universityId" /></Field>
          <Field label="البريد الإلكتروني" required><Input type="email" name="email" defaultValue={r?.email} required dir="ltr" className="text-left" /><FieldError name="email" /></Field>
          <Field label="رقم الهاتف"><Input name="phone" defaultValue={r?.phone ?? ""} dir="ltr" className="text-left" /><FieldError name="phone" /></Field>
          <Field label="الفئة" required>
            <NativeSelect name="type" defaultValue={r?.type ?? "STUDENT"}>{Object.entries(RESEARCHER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          </Field>
          <Field label="الدرجة العلمية" required>
            <NativeSelect name="academicDegree" defaultValue={r?.academicDegree ?? "BACHELOR_STUDENT"}>{Object.entries(DEGREE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          </Field>
          <CollegeDepartmentSelect colleges={colleges} departments={departments} defaultCollegeId={r?.collegeId} defaultDepartmentId={r?.departmentId} />
          <Field label="التخصص"><Input name="specialization" defaultValue={r?.specialization ?? ""} /></Field>
          <Field label="ملاحظات" className="md:col-span-2"><Textarea name="notes" defaultValue={r?.notes ?? ""} rows={2} /></Field>
          {!r?.userId && (
            <div className="grid gap-3 rounded-lg border border-dashed p-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold"><Checkbox name="createAccount" /> إنشاء حساب دخول للباحث (دور: باحث)</label>
              <Field label="كلمة المرور الأولية" hint="8 أحرف على الأقل — يُطلب من الباحث تغييرها من ملفه الشخصي">
                <Input type="password" name="password" autoComplete="new-password" dir="ltr" className="max-w-sm text-left" />
              </Field>
            </div>
          )}
          <div><SubmitButton>{r ? "حفظ التعديلات" : "إضافة الباحث"}</SubmitButton></div>
        </CardContent>
      </Card>
    </ActionForm>
  );
}
