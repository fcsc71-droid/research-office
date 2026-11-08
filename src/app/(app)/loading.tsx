import { Loader2 } from "lucide-react";
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-brand" /> جارٍ التحميل...
    </div>
  );
}
