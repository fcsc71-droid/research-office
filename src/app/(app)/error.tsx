"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow">
        <AlertTriangle className="mx-auto mb-2 size-10 text-amber-500" />
        <h2 className="font-bold text-navy">حدث خطأ أثناء تحميل الصفحة</h2>
        <p className="mt-1 text-sm text-muted-foreground">يرجى إعادة المحاولة. إذا استمرت المشكلة تواصل مع الدعم الفني.</p>
        {error.digest && <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">ref: {error.digest}</p>}
        <Button className="mt-4" onClick={reset}>إعادة المحاولة</Button>
      </div>
    </div>
  );
}
