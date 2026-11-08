"use client";
import Link from "next/link";
import { LogOut, UserCircle, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/actions/auth";

export function UserMenu({ name, roleName, email }: { name: string; roleName: string; email: string }) {
  const initials = name.split(" ").slice(0, 2).map((s) => s[0]).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 outline-none hover:bg-accent">
        <span className="flex size-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{initials}</span>
        <span className="hidden text-start leading-tight sm:block">
          <span className="block text-sm font-bold text-navy">{name}</span>
          <span className="block text-[11px] text-muted-foreground">{roleName}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block">{name}</span>
          <span className="block text-xs font-normal text-muted-foreground" dir="ltr">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile"><UserCircle /> الملف الشخصي</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logoutAction()} className="text-destructive focus:text-destructive">
          <LogOut className="!text-destructive" /> تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
