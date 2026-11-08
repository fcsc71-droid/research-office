import "server-only";
import { db } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/enums";
import type { PermissionCode } from "@/lib/constants";

export async function notify(
  userIds: (string | null | undefined)[],
  data: { type: NotificationType; title: string; body?: string; link?: string },
  excludeUserId?: string,
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== excludeUserId))];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...data })) });
}

/** معرفات المستخدمين النشطين الذين يملكون إحدى الصلاحيات */
export async function usersWithPermission(...codes: PermissionCode[]) {
  const users = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { key: "ADMIN" } },
        { role: { permissions: { some: { permission: { code: { in: codes } } } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** معرفات مستخدمي الباحثين المرتبطين ببحث (الرئيسي + المشاركون + المنشئ) */
export async function paperOwnerUserIds(paperId: string) {
  const p = await db.researchPaper.findUnique({
    where: { id: paperId },
    select: {
      createdById: true,
      createdBy: { select: { role: { select: { key: true } } } },
      mainResearcher: { select: { userId: true } },
      authors: { select: { researcher: { select: { userId: true } } } },
    },
  });
  if (!p) return [];
  const ids = [p.mainResearcher.userId, ...p.authors.map((a) => a.researcher?.userId)];
  if (p.createdBy.role.key === "RESEARCHER") ids.push(p.createdById);
  return ids.filter((x): x is string => !!x);
}

/** إنشاء تنبيهات اقتراب مواعيد التحكيم (تُستدعى دورياً) */
export async function runDeadlineReminders(reminderDays: number) {
  const soon = new Date(Date.now() + reminderDays * 86400 * 1000);
  const due = await db.reviewAssignment.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lte: soon }, reminderSentAt: null },
    include: { paper: { select: { id: true, referenceNo: true, titleAr: true } } },
  });
  if (!due.length) return 0;
  const managers = await usersWithPermission("reviews.assign");
  for (const a of due) {
    const overdue = a.dueDate < new Date();
    await notify([a.reviewerId], {
      type: "DEADLINE",
      title: overdue ? "تجاوز موعد تسليم التحكيم" : "اقتراب موعد تسليم التحكيم",
      body: `البحث ${a.paper.referenceNo}: ${a.paper.titleAr}`,
      link: `/reviews/${a.id}`,
    });
    await notify(managers, {
      type: "DEADLINE",
      title: overdue ? "تحكيم متأخر عن موعده" : "موعد تحكيم يقترب",
      body: `البحث ${a.paper.referenceNo}: ${a.paper.titleAr}`,
      link: `/research/${a.paper.id}`,
    });
    await db.reviewAssignment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
  }
  return due.length;
}

let lastDeadlineCheck = 0;
/** تشغيل فحص المواعيد بشكل غير متزامن مرة كل ساعة كحد أقصى لكل عملية خادم */
export function maybeRunDeadlineReminders(reminderDays: number) {
  if (Date.now() - lastDeadlineCheck < 3600 * 1000) return;
  lastDeadlineCheck = Date.now();
  runDeadlineReminders(reminderDays).catch((e) => console.error("deadline reminders failed", e));
}
