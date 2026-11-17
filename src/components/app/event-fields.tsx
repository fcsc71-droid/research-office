import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/app/misc";
import { FieldError } from "@/components/app/action-form";
import { MultiPicker } from "@/components/app/pickers";
import { EVENT_SCOPE_LABELS, EVENT_TYPE_LABELS, PARTICIPATION_ROLE_LABELS, FILE_ACCEPT_ATTR } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import type { ScientificEvent, EventParticipant } from "@/generated/prisma/client";

export async function EventFields({ e, institute, manager }: { e?: ScientificEvent & { participants: EventParticipant[] }; institute: boolean; manager: boolean }) {
  const researchers = await db.researcher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, universityId: true } });
  const opts = researchers.map((r) => ({ id: r.id, name: r.fullName, sub: r.universityId }));
  const first = e?.participants[0];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {institute && <input type="hidden" name="institute" value="1" />}
      <Field label={institute ? "اسم النشاط" : "اسم الفعالية"} required className="sm:col-span-2"><Input name="name" defaultValue={e?.name} required /><FieldError name="name" /></Field>
      <Field label="النوع" required>
        <NativeSelect name="type" defaultValue={e?.type ?? (institute ? "WORKSHOP" : "CONFERENCE")} required>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
      </Field>
      <Field label="النطاق">
        <NativeSelect name="scope" defaultValue={e?.scope ?? "LOCAL"}>{Object.entries(EVENT_SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
      </Field>
      {!institute && <Field label="الجهة المنظمة"><Input name="organizer" defaultValue={e?.organizer ?? ""} /></Field>}
      <Field label="مكان الانعقاد"><Input name="location" defaultValue={e?.location ?? ""} /></Field>
      <Field label="تاريخ الانعقاد" required><Input type="date" name="startDate" defaultValue={toInputDate(e?.startDate)} required /><FieldError name="startDate" /></Field>
      <Field label="تاريخ الانتهاء"><Input type="date" name="endDate" defaultValue={toInputDate(e?.endDate)} /></Field>
      <Field label={institute ? "المنظمون من أعضاء المعهد" : manager ? "المشاركون من المعهد" : "مشاركون آخرون من المعهد (تُضاف أنت تلقائياً)"} className="sm:col-span-2">
        <MultiPicker name="participants" options={opts} defaultValues={e?.participants.map((p) => p.researcherId) ?? []} />
      </Field>
      {!institute && (
        <>
          <Field label="نوع المشاركة">
            <NativeSelect name="role" defaultValue={first?.role ?? "ATTENDANCE"}>{Object.entries(PARTICIPATION_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          </Field>
          <Field label="عنوان الورقة العلمية المقدمة (إن وجدت)"><Input name="paperTitle" defaultValue={first?.paperTitle ?? ""} /></Field>
        </>
      )}
      {institute && <Field label="عدد الحضور"><Input type="number" min={0} name="attendeesCount" defaultValue={e?.attendeesCount ?? ""} /></Field>}
      <Field label="رابط الفعالية / موقعها الإلكتروني"><Input type="url" name="url" defaultValue={e?.url ?? ""} dir="ltr" className="text-left" /><FieldError name="url" /></Field>
      <Field label="وصف مختصر" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={e?.description ?? ""} /></Field>
      <Field label={institute ? "الصور والتقارير والبرنامج وقوائم الحضور" : "شهادة المشاركة أو البرنامج العلمي"} className="sm:col-span-2">
        <Input type="file" name="files" multiple accept={FILE_ACCEPT_ATTR} className="h-auto py-2" />
      </Field>
    </div>
  );
}
