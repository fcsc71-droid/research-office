import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg">
        <FileQuestion className="mx-auto mb-3 size-12 text-brand" />
        <h1 className="text-xl font-extrabold text-navy">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-muted-foreground">لم يتم العثور على الصفحة أو السجل المطلوب، أو لا تملك صلاحية الوصول إليه.</p>
        <Button asChild className="mt-5"><Link href="/dashboard">العودة للوحة التحكم</Link></Button>
      </div>
    </main>
  );
}
