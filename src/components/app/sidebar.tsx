"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Archive, Award, BarChart3, FileSpreadsheet, Bell, Building, Building2, CalendarDays, ClipboardCheck, FilePlus2, FileText, FolderKanban, GraduationCap,
  Handshake, History, KeyRound, LayoutDashboard, Library, Menu, Presentation, Settings, Sparkles, UserCheck, UserCircle, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav";
import { APP_NAME, LOGO_PATH } from "@/lib/constants";

const ICONS = {
  Archive, Award, BarChart3, FileSpreadsheet, Bell, Building, Building2, CalendarDays, ClipboardCheck, FilePlus2, FileText, FolderKanban, GraduationCap,
  Handshake, History, KeyRound, LayoutDashboard, Library, Presentation, Settings, Sparkles, UserCheck, UserCircle, Users,
} as const;

function NavList({ items, onNavigate, unread }: { items: NavItem[]; onNavigate?: () => void; unread: number }) {
  const pathname = usePathname();
  const sections = [...new Set(items.map((i) => i.section))];
  const isActive = (href: string) =>
    href === "/research" ? pathname === "/research" || (/^\/research\/(?!new)/.test(pathname)) : pathname === href || pathname.startsWith(href + "/");
  return (
    <nav className="flex flex-col gap-5">
      {sections.map((s) => (
        <div key={s}>
          <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wide text-sidebar-foreground/50">{s}</p>
          <ul className="grid gap-0.5">
            {items.filter((i) => i.section === s).map((i) => {
              const Icon = ICONS[i.icon as keyof typeof ICONS] ?? FileText;
              const active = isActive(i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "bg-white text-navy shadow-sm" : "text-sidebar-foreground/85 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-[18px]", active ? "text-brand" : "text-sidebar-foreground/60")} />
                    <span className="flex-1">{i.label}</span>
                    {i.href === "/notifications" && unread > 0 && (
                      <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{unread}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_PATH} alt="شعار المعهد العالي للتقنيات الهندسية – بنغازي" className="size-12 shrink-0 rounded-full bg-white p-0.5 shadow" />
      <div className="leading-tight">
        <p className="text-sm font-extrabold text-white">مكتب البحث العلمي</p>
        <p className="text-[11px] text-sidebar-foreground/70">المعهد العالي للتقنيات الهندسية – بنغازي</p>
      </div>
    </div>
  );
}

export function Sidebar({ items, unread }: { items: NavItem[]; unread: number }) {
  return (
    <aside data-sidebar className="no-print fixed inset-y-0 right-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto bg-sidebar p-4 lg:flex" aria-label={APP_NAME}>
      <Brand />
      <NavList items={items} unread={unread} />
    </aside>
  );
}

export function MobileNav({ items, unread }: { items: NavItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex size-9 items-center justify-center rounded-md border bg-card lg:hidden" aria-label="القائمة">
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 flex-col gap-6 overflow-y-auto bg-sidebar p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} className="text-white/70" aria-label="إغلاق"><X className="size-5" /></button>
            </div>
            <NavList items={items} unread={unread} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
