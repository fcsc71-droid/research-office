import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "غير مصرح" };

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg">
        <ShieldAlert className="mx-auto mb-3 size-12 text-destructive" />
        <h1 className="text-xl font-extrabold text-navy">ليست لديك صلاحية الوصول</h1>
        <p className="mt-2 text-sm text-muted-foreground">لا تملك الصلاحية اللازمة لعرض هذه الصفحة أو تنفيذ هذا الإجراء. تواصل مع مدير النظام إذا كنت تعتقد أن هذا خطأ.</p>
        <Button asChild className="mt-5"><Link href="/dashboard">العودة للوحة التحكم</Link></Button>
      </div>
    </main>
  );
}
