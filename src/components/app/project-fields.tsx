import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/app/misc";
import { FieldError } from "@/components/app/action-form";
import { MultiPicker, SinglePicker } from "@/components/app/pickers";
import { PROJECT_STATUS_LABELS, FILE_ACCEPT_ATTR } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import type { ResearchProject, ProjectMember } from "@/generated/prisma/client";

export async function ProjectFields({ p, manager }: { p?: ResearchProject & { members: ProjectMember[] }; manager: boolean }) {
  const [researchers, departments] = await Promise.all([
    db.researcher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, universityId: true } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const opts = researchers.map((r) => ({ id: r.id, name: r.fullName, sub: r.universityId }));
  const statuses = manager ? Object.entries(PROJECT_STATUS_LABELS) : Object.entries(PROJECT_STATUS_LABELS).filter(([k]) => !["UNDER_REVIEW", "APPROVED"].includes(k));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="عنوان المشروع" required className="sm:col-span-2"><Input name="title" defaultValue={p?.title} required /><FieldError name="title" /></Field>
      {manager && <Field label="الباحث الرئيسي" required><SinglePicker name="leadId" options={opts} defaultValue={p?.leadId} /><FieldError name="leadId" /></Field>}
      <Field label="أعضاء الفريق البحثي"><MultiPicker name="members" options={opts} defaultValues={p?.members.filter((m) => m.researcherId).map((m) => m.researcherId!) ?? []} exclude={p?.leadId} /></Field>
      <Field label="أعضاء من خارج المعهد" hint="اسم في كل سطر"><Textarea name="externalMembers" rows={2} defaultValue={p?.members.filter((m) => !m.researcherId).map((m) => m.name).join("\n")} /></Field>
      <Field label="القسم العلمي">
        <NativeSelect name="departmentId" defaultValue={p?.departmentId ?? ""}>
          <option value="">— قسم الباحث الرئيسي —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="حالة المشروع">
        <NativeSelect name="status" defaultValue={p?.status ?? "PROPOSAL"}>{statuses.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
      </Field>
      <Field label="تاريخ البداية"><Input type="date" name="startDate" defaultValue={toInputDate(p?.startDate)} /></Field>
      <Field label="تاريخ النهاية المتوقع"><Input type="date" name="expectedEndDate" defaultValue={toInputDate(p?.expectedEndDate)} /></Field>
      <Field label="أهداف المشروع" className="sm:col-span-2"><Textarea name="objectives" rows={3} defaultValue={p?.objectives ?? ""} /></Field>
      <Field label="ملخص المشروع" className="sm:col-span-2"><Textarea name="summary" rows={3} defaultValue={p?.summary ?? ""} /></Field>
      <Field label="المخرجات المتوقعة"><Textarea name="expectedOutputs" rows={2} defaultValue={p?.expectedOutputs ?? ""} /></Field>
      <Field label="المخرجات الفعلية"><Textarea name="actualOutputs" rows={2} defaultValue={p?.actualOutputs ?? ""} /></Field>
      <Field label="الجهات المتعاونة أو الممولة"><Input name="partners" defaultValue={p?.partners ?? ""} /></Field>
      <Field label="دورية تقرير الإنجاز">
        <NativeSelect name="reportEveryMonths" defaultValue={String(p?.reportEveryMonths ?? "")}>
          <option value="">بدون</option><option value="3">كل 3 أشهر</option><option value="6">كل 6 أشهر</option>
        </NativeSelect>
      </Field>
      <Field label="الملفات والمرفقات" className="sm:col-span-2"><Input type="file" name="files" multiple accept={FILE_ACCEPT_ATTR} className="h-auto py-2" /></Field>
    </div>
  );
}
