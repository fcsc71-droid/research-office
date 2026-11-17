"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { importAction, type ImportActionResult } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function ImportForm({ type, canApprove }: { type: "researchers" | "papers"; canApprove?: boolean }) {
  const [state, action, pending] = useActionState<ImportActionResult | null, FormData>(importAction, null);
  const router = useRouter();
  useEffect(() => {
    if (!state) return;
    if (state.ok) { toast.success(state.message); router.refresh(); } else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ts]);
  return (
    <div className="grid gap-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <Input type="file" name="file" accept=".xlsx" required className="h-auto max-w-sm py-2" />
        {type === "papers" && canApprove && (
          <label className="flex items-center gap-2 text-sm"><Checkbox name="approveNow" /> اعتماد البحوث مباشرة (بعد التحقق من الملف)</label>
        )}
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Upload />} {pending ? "جارٍ الاستيراد..." : "استيراد"}</Button>
      </form>
      {state?.result && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-bold text-navy">النتيجة: أضيف {state.result.created} سجل — تم تجاوز {state.result.skipped.length} صف</p>
          {state.result.skipped.length > 0 && (
            <ul className="mt-2 max-h-56 list-inside list-disc overflow-y-auto text-xs text-rose-800">
              {state.result.skipped.map((s) => <li key={s.row}>الصف {s.row}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
