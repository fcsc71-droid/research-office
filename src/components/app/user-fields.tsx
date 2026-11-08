import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/app/misc";
import { FieldError } from "@/components/app/action-form";

type U = {
  name: string; email: string; phone: string | null; roleId: string; isActive: boolean; academicTitle: string | null;
  specialization: string | null; institution: string | null; departmentId: string | null;
};

export function UserFields({
  u, roles, departments, reviewerMode, fixedRoleId,
}: {
  u?: U;
  roles: { id: string; name: string }[];
  departments: { id: string; name: string; college: { name: string } }[];
  reviewerMode?: boolean;
  fixedRoleId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reviewerMode && <input type="hidden" name="redirect" value="/reviewers" />}
      <Field label="الاسم الكامل" required><Input name="name" defaultValue={u?.name} required /><FieldError name="name" /></Field>
      <Field label="البريد الإلكتروني" required><Input type="email" name="email" defaultValue={u?.email} required dir="ltr" className="text-left" /><FieldError name="email" /></Field>
      <Field label="الهاتف"><Input name="phone" defaultValue={u?.phone ?? ""} dir="ltr" className="text-left" /></Field>
      {fixedRoleId ? (
        <input type="hidden" name="roleId" value={fixedRoleId} />
      ) : (
        <Field label="الدور" required>
          <NativeSelect name="roleId" defaultValue={u?.roleId ?? ""} required>
            <option value="">— اختر —</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </NativeSelect>
        </Field>
      )}
      <Field label="اللقب العلمي"><Input name="academicTitle" defaultValue={u?.academicTitle ?? ""} placeholder="مثال: أستاذ مشارك" /></Field>
      <Field label="التخصص"><Input name="specialization" defaultValue={u?.specialization ?? ""} /></Field>
      <Field label="الجهة / المؤسسة"><Input name="institution" defaultValue={u?.institution ?? ""} /></Field>
      <Field label="القسم">
        <NativeSelect name="departmentId" defaultValue={u?.departmentId ?? ""}>
          <option value="">— بدون —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.college.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label={u ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"} required={!u} hint="8 أحرف على الأقل وتحتوي حرفاً ورقماً">
        <Input type="password" name="password" required={!u} autoComplete="new-password" dir="ltr" className="text-left" /><FieldError name="password" />
      </Field>
      {u && (
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold"><Checkbox name="isActive" defaultChecked={u.isActive} /> الحساب مفعّل</label>
      )}
    </div>
  );
}
