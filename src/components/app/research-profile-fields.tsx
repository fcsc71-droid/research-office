import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/misc";
import { FieldError } from "@/components/app/action-form";
import { FILE_ACCEPT_ATTR } from "@/lib/constants";

type R = {
  generalSpecialization?: string | null; jobTitle?: string | null; qualification?: string | null; qualificationYear?: number | null;
  researchInterests?: string[]; orcid?: string | null; googleScholar?: string | null; scopusId?: string | null; researchGate?: string | null;
};

/** حقول الملف البحثي (البيانات الأكاديمية والوظيفية والمعرفات العلمية) — وفق نموذج البيانات البحثية لعضو هيئة التدريس */
export function ResearchProfileFields({ r }: { r?: R | null }) {
  return (
    <>
      <Field label="التخصص العام"><Input name="generalSpecialization" defaultValue={r?.generalSpecialization ?? ""} /></Field>
      <Field label="المسمى الوظيفي"><Input name="jobTitle" defaultValue={r?.jobTitle ?? ""} placeholder="مثال: عضو هيئة تدريس، رئيس قسم" /></Field>
      <Field label="المؤهل العلمي"><Input name="qualification" defaultValue={r?.qualification ?? ""} placeholder="مثال: دكتوراه في الهندسة المدنية" /></Field>
      <Field label="سنة الحصول على المؤهل"><Input type="number" name="qualificationYear" min={1950} max={2100} defaultValue={r?.qualificationYear ?? ""} /><FieldError name="qualificationYear" /></Field>
      <Field label="الاهتمامات البحثية" hint="افصل بينها بفاصلة — تُستخدم في البحث المتقدم عن الباحثين" className="md:col-span-2">
        <Textarea name="researchInterests" rows={2} defaultValue={r?.researchInterests?.join("، ") ?? ""} placeholder="مثال: هندسة الطرق، الذكاء الاصطناعي، الطاقة المتجددة" />
      </Field>
      <Field label="ORCID ID"><Input name="orcid" defaultValue={r?.orcid ?? ""} dir="ltr" className="text-left" placeholder="0000-0002-1825-0097" /><FieldError name="orcid" /></Field>
      <Field label="Scopus Author ID"><Input name="scopusId" defaultValue={r?.scopusId ?? ""} dir="ltr" className="text-left" /><FieldError name="scopusId" /></Field>
      <Field label="رابط Google Scholar"><Input name="googleScholar" type="url" defaultValue={r?.googleScholar ?? ""} dir="ltr" className="text-left" placeholder="https://scholar.google.com/..." /><FieldError name="googleScholar" /></Field>
      <Field label="رابط ResearchGate"><Input name="researchGate" type="url" defaultValue={r?.researchGate ?? ""} dir="ltr" className="text-left" /><FieldError name="researchGate" /></Field>
      <Field label="السيرة الذاتية CV" hint="PDF أو DOCX — يُضاف كنسخة جديدة مع الاحتفاظ بالسابقة" className="md:col-span-2">
        <Input type="file" name="cv" accept={FILE_ACCEPT_ATTR} className="h-auto py-2" />
      </Field>
    </>
  );
}
