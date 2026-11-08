import Link from "next/link";
import { Bell, CheckCheck, Trash2, Check, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { markAllNotificationsReadAction, markNotificationReadAction, deleteReadNotificationsAction } from "@/actions/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PageHeader, EmptyState, Pagination } from "@/components/app/misc";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "الإشعارات" };
const PAGE_SIZE = 25;
const TYPE_ICONS: Record<string, string> = {
  NEW_SUBMISSION: "📥", STATUS_CHANGED: "🔄", REVIEWER_ASSIGNED: "🧑‍⚖️", COMMENT_ADDED: "💬", REVISION_REQUESTED: "✏️",
  DECISION: "📌", DEADLINE: "⏰", REVIEW_SUBMITTED: "✅", SYSTEM: "🔔",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = { userId: me.id, ...(sp.unread === "1" ? { readAt: null } : {}) };
  const [total, items, unread] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.notification.count({ where: { userId: me.id, readAt: null } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={<Bell />} title="الإشعارات" description={`لديك ${unread} إشعار غير مقروء`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href={sp.unread === "1" ? "/notifications" : "/notifications?unread=1"}>{sp.unread === "1" ? "عرض الكل" : "غير المقروءة فقط"}</Link></Button>
            {unread > 0 && <ConfirmButton action={markAllNotificationsReadAction} title="تعليم الكل كمقروء" confirmVariant="default" variant="outline"><CheckCheck /> تعليم الكل كمقروء</ConfirmButton>}
            <ConfirmButton action={deleteReadNotificationsAction} title="حذف الإشعارات المقروءة" description="سيتم حذف جميع الإشعارات المقروءة." confirmText="حذف" variant="outline" className="text-destructive"><Trash2 /> حذف المقروءة</ConfirmButton>
          </>
        } />
      <Card className="overflow-hidden">
        {items.length === 0 ? <EmptyState title="لا توجد إشعارات" /> : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 p-4", !n.readAt && "bg-brand-soft/25")}>
                <span className="text-xl leading-none">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.readAt ? "font-bold text-navy" : "font-semibold")}>{n.title}</p>
                  {n.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {n.link && <Button asChild variant="ghost" size="icon-sm" title="فتح"><Link href={n.link}><ExternalLink /></Link></Button>}
                  {!n.readAt && <ConfirmButton action={markNotificationReadAction.bind(null, n.id)} title="تعليم كمقروء" confirmVariant="default" variant="ghost" size="icon-sm"><Check /></ConfirmButton>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/notifications" params={sp} />
      </Card>
    </div>
  );
}
