"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** إنشاء حسابات دخول لجميع الأساتذة الذين ليس لديهم حساب، وتنزيل ملف بكلمات المرور المؤقتة */
export function BulkAccountsButton({ count, departments }: { count: number; departments: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/researchers/bulk-accounts", { method: "POST", body: new FormData(e.currentTarget) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "تعذر إنشاء الحسابات");
      const blob = await res.blob();
      const name = decodeURIComponent((res.headers.get("content-disposition") ?? "").match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "accounts.xlsx");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("تم إنشاء الحسابات وتنزيل ملف بيانات الدخول");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><KeyRound /> إنشاء حسابات للجميع ({count})</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إنشاء حسابات دخول لأعضاء هيئة التدريس</DialogTitle>
          <DialogDescription>
            سيُنشأ حساب (دور: عضو هيئة تدريس) لكل من ليس لديه حساب، باسم دخول هو بريده الإلكتروني وكلمة مرور مؤقتة يُطلب تغييرها عند أول دخول.
            سيُنزَّل ملف Excel بكلمات المرور — <b>تظهر مرة واحدة فقط</b>، فاحفظه وسلّم كل عضو بياناته على حدة ثم احذفه.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            القسم
            <NativeSelect name="departmentId" defaultValue="">
              <option value="">جميع الأقسام</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </label>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="includeStudents" /> تضمين الطلاب الباحثين أيضاً</label>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <KeyRound />} {pending ? "جارٍ الإنشاء..." : "إنشاء الحسابات وتنزيل الملف"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
