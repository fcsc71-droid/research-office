import Link from "next/link";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

export type FilterField =
  | { type: "search"; name: string; placeholder?: string; value?: string }
  | { type: "select"; name: string; label: string; value?: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string; value?: string };

/** شريط تصفية يعمل عبر GET (يحفظ الحالة في الرابط ويعمل دون JavaScript) */
export function FilterBar({ fields, basePath, hidden }: { fields: FilterField[]; basePath: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form method="get" action={basePath} className="no-print flex flex-wrap items-end gap-2 border-b p-4">
      {hidden && Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) =>
        f.type === "search" ? (
          <div key={f.name} className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name={f.name} defaultValue={f.value} placeholder={f.placeholder ?? "بحث..."} className="pe-9" />
          </div>
        ) : f.type === "date" ? (
          <label key={f.name} className="grid gap-1 text-xs font-semibold text-muted-foreground">
            {f.label}
            <Input type="date" name={f.name} defaultValue={f.value} className="w-40" />
          </label>
        ) : (
          <label key={f.name} className="grid w-44 gap-1 text-xs font-semibold text-muted-foreground">
            {f.label}
            <NativeSelect name={f.name} defaultValue={f.value ?? ""}>
              <option value="">الكل</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </label>
        ),
      )}
      <Button type="submit" variant="default"><Search /> تطبيق</Button>
      <Button asChild variant="ghost"><Link href={basePath}><RotateCcw /> إعادة تعيين</Link></Button>
    </form>
  );
}
