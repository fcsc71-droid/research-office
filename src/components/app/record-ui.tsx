import { CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FormDialog } from "@/components/app/form-dialog";
import { Field } from "@/components/app/misc";
import { RECORD_STATUS_COLORS, RECORD_STATUS_LABELS } from "@/lib/constants";
import type { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", RECORD_STATUS_COLORS[status])}>{RECORD_STATUS_LABELS[status]}</span>;
}

/** أزرار مراجعة السجل: اعتماد أو إعادة لاستكمال البيانات */
export function ApprovalButton({ action, status }: { action: (p: ActionResult | null, fd: FormData) => Promise<ActionResult>; status: RecordStatus }) {
  return (
    <FormDialog
      trigger={<Button variant={status === "PENDING" ? "default" : "ghost"} size="sm">{status === "PENDING" ? <><CheckCircle2 /> مراجعة</> : <Undo2 />}</Button>}
      title="مراجعة السجل واعتماده"
      description="تحقق من صحة البيانات والمستندات وعدم تكرار السجل قبل الاعتماد. السجلات المعتمدة فقط تظهر في التقارير الرسمية."
      action={action}
      submitText="تنفيذ"
    >
      <Field label="القرار">
        <NativeSelect name="decision" defaultValue={status === "APPROVED" ? "RETURNED" : "APPROVED"}>
          <option value="APPROVED">اعتماد السجل</option>
          <option value="RETURNED">إعادة لاستكمال البيانات</option>
        </NativeSelect>
      </Field>
      <Field label="ملاحظات للباحث" hint="إلزامية عند الإرجاع"><Textarea name="note" rows={3} /></Field>
    </FormDialog>
  );
}

export function ApprovalNote({ status, note }: { status: RecordStatus; note: string | null }) {
  if (status !== "RETURNED" || !note) return null;
  return <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-xs text-rose-800">ملاحظة الإرجاع: {note}</p>;
}
