import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, WATERMARK_TEXT } from "@/lib/constants";
import type { ResearchStatus } from "@/generated/prisma/enums";

export function Watermark() {
  return (
    <div className="app-watermark" aria-hidden="true" data-watermark>
      <span>{WATERMARK_TEXT}</span>
    </div>
  );
}

export function StatusBadge({ status, className }: { status: ResearchStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white [&_svg]:size-5">{icon}</div>}
        <div>
          <h1 className="text-xl font-extrabold text-navy sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-brand">
        <Inbox className="size-6" />
      </div>
      <p className="font-bold text-navy">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <div className="no-print flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        إجمالي النتائج: <b className="text-foreground">{total}</b> — صفحة {page} من {pages}
      </span>
      <div className="flex gap-1">
        <Link
          aria-disabled={page <= 1}
          href={href(Math.max(1, page - 1))}
          className={cn("flex h-8 items-center gap-1 rounded-md border bg-card px-2", page <= 1 && "pointer-events-none opacity-40")}
        >
          <ChevronRight className="size-4" /> السابق
        </Link>
        <Link
          aria-disabled={page >= pages}
          href={href(Math.min(pages, page + 1))}
          className={cn("flex h-8 items-center gap-1 rounded-md border bg-card px-2", page >= pages && "pointer-events-none opacity-40")}
        >
          التالي <ChevronLeft className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b py-2 text-sm last:border-0">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function Field({ label, children, required, hint, className }: { label: string; children: React.ReactNode; required?: boolean; hint?: string; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <span className="text-sm font-semibold text-foreground/90">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "navy",
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "navy" | "blue" | "amber" | "green" | "red" | "teal" | "slate" | "indigo";
  href?: string;
}) {
  const tones: Record<string, string> = {
    navy: "bg-navy text-white",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    teal: "bg-teal-100 text-teal-700",
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  const body = (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/[0.88] p-4 shadow-sm transition hover:shadow-md">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
      </div>
      <div className={cn("flex size-11 items-center justify-center rounded-lg [&_svg]:size-5", tones[tone])}>{icon}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
