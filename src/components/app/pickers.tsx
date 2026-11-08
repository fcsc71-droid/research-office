"use client";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string; sub?: string };

/** اختيار الكلية ثم القسم التابع لها */
export function CollegeDepartmentSelect({
  colleges,
  departments,
  defaultCollegeId,
  defaultDepartmentId,
  required,
}: {
  colleges: Opt[];
  departments: (Opt & { collegeId: string })[];
  defaultCollegeId?: string | null;
  defaultDepartmentId?: string | null;
  required?: boolean;
}) {
  const [collegeId, setCollegeId] = useState(defaultCollegeId ?? "");
  const [deptId, setDeptId] = useState(defaultDepartmentId ?? "");
  const filtered = departments.filter((d) => !collegeId || d.collegeId === collegeId);
  return (
    <>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">الكلية {required && <span className="text-destructive">*</span>}</span>
        <NativeSelect name="collegeId" value={collegeId} required={required} onChange={(e) => { setCollegeId(e.target.value); setDeptId(""); }}>
          <option value="">— اختر الكلية —</option>
          {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">القسم العلمي {required && <span className="text-destructive">*</span>}</span>
        <NativeSelect name="departmentId" value={deptId} required={required} onChange={(e) => setDeptId(e.target.value)}>
          <option value="">— اختر القسم —</option>
          {filtered.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </NativeSelect>
      </label>
    </>
  );
}

/** منتقي باحث واحد مع بحث نصي */
export function SinglePicker({ name, options, defaultValue, placeholder = "ابحث بالاسم أو الرقم..." }: { name: string; options: Opt[]; defaultValue?: string | null; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [value, setValue] = useState(defaultValue ?? "");
  const selected = options.find((o) => o.id === value);
  const list = useMemo(() => options.filter((o) => !q || o.name.includes(q) || o.sub?.includes(q)).slice(0, 50), [q, options]);
  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      {selected ? (
        <div className="flex items-center justify-between rounded-md border bg-brand-soft/40 px-3 py-2 text-sm">
          <span><b>{selected.name}</b> {selected.sub && <span className="text-muted-foreground">— {selected.sub}</span>}</span>
          <button type="button" onClick={() => setValue("")} className="text-muted-foreground hover:text-destructive" aria-label="إزالة"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="relative border-b">
            <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="border-0 pe-9 shadow-none focus-visible:ring-0" />
          </div>
          <ul className="max-h-48 overflow-y-auto p-1">
            {list.length === 0 && <li className="p-2 text-center text-xs text-muted-foreground">لا توجد نتائج</li>}
            {list.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setValue(o.id)} className="w-full rounded px-2 py-1.5 text-start text-sm hover:bg-accent">
                  {o.name} {o.sub && <span className="text-xs text-muted-foreground">— {o.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** منتقي متعدد (الباحثون المشاركون) */
export function MultiPicker({ name, options, defaultValues = [], exclude }: { name: string; options: Opt[]; defaultValues?: string[]; exclude?: string }) {
  const [q, setQ] = useState("");
  const [values, setValues] = useState<string[]>(defaultValues);
  const list = options.filter((o) => o.id !== exclude && !values.includes(o.id) && (!q || o.name.includes(q) || o.sub?.includes(q))).slice(0, 30);
  return (
    <div className="grid gap-2">
      {values.map((v) => <input key={v} type="hidden" name={`${name}[]`} value={v} />)}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => {
            const o = options.find((x) => x.id === v);
            return (
              <span key={v} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-navy">
                {o?.name ?? v}
                <button type="button" onClick={() => setValues(values.filter((x) => x !== v))} aria-label="إزالة"><X className="size-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      <div className="rounded-md border">
        <div className="relative border-b">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث لإضافة باحث مشارك..." className="border-0 pe-9 shadow-none focus-visible:ring-0" />
        </div>
        <ul className={cn("max-h-36 overflow-y-auto p-1", !q && "max-h-28")}>
          {list.length === 0 && <li className="p-2 text-center text-xs text-muted-foreground">لا توجد نتائج</li>}
          {list.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => { setValues([...values, o.id]); setQ(""); }} className="w-full rounded px-2 py-1.5 text-start text-sm hover:bg-accent">
                + {o.name} {o.sub && <span className="text-xs text-muted-foreground">— {o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
