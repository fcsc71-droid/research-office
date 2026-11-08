import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { maybeRunDeadlineReminders } from "@/lib/notify";
import { NAV_ITEMS } from "@/components/app/nav";
import { Sidebar, MobileNav } from "@/components/app/sidebar";
import { UserMenu } from "@/components/app/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();

  // فحص مواعيد التحكيم القريبة (مرة كل ساعة كحد أقصى)
  maybeRunDeadlineReminders(settings.deadlineReminderDays);

  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const items = NAV_ITEMS.filter((i) => !i.perms || i.perms.some((p) => can(user, p)));

  return (
    <div className="min-h-screen">
      <Sidebar items={items} unread={unread} />
      <div className="lg:pr-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNav items={items} unread={unread} />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-navy">{settings.officeName}</p>
              <p className="text-xs text-muted-foreground">{settings.universityName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative flex size-9 items-center justify-center rounded-full border bg-card hover:bg-accent" aria-label="الإشعارات">
              <Bell className="size-[18px] text-navy" />
              {unread > 0 && (
                <span className="absolute -top-1 -left-1 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <UserMenu name={user.name} roleName={user.roleName} email={user.email} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
