import "server-only";
import { can, type CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

/** المشاريع المرئية: الإدارة ترى الكل، رئيس القسم يرى قسمه، وعضو هيئة التدريس يرى مشاريعه */
export function projectsWhere(user: CurrentUser): Prisma.ResearchProjectWhereInput {
  if (can(user, "projects.manage") || can(user, "records.approve")) return {};
  const own: Prisma.ResearchProjectWhereInput[] = [
    { createdById: user.id },
    { lead: { userId: user.id } },
    { members: { some: { researcher: { userId: user.id } } } },
  ];
  if (can(user, "research.view_department") && user.departmentId) own.push({ departmentId: user.departmentId });
  return { OR: own };
}

export function eventsWhere(user: CurrentUser): Prisma.ScientificEventWhereInput {
  if (can(user, "events.manage") || can(user, "records.approve")) return {};
  const own: Prisma.ScientificEventWhereInput[] = [
    { createdById: user.id },
    { participants: { some: { researcher: { userId: user.id } } } },
  ];
  if (can(user, "research.view_department") && user.departmentId) {
    own.push({ participants: { some: { researcher: { departmentId: user.departmentId } } } });
  }
  return { OR: own };
}

export function awardsWhere(user: CurrentUser): Prisma.AwardWhereInput {
  if (can(user, "awards.manage") || can(user, "records.approve")) return {};
  const own: Prisma.AwardWhereInput[] = [{ createdById: user.id }, { researcher: { userId: user.id } }];
  if (can(user, "research.view_department") && user.departmentId) own.push({ researcher: { departmentId: user.departmentId } });
  return { OR: own };
}
