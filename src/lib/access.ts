import "server-only";
import { db } from "@/lib/db";
import { can, type CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

/** شرط الأبحاث التي يملكها المستخدم كباحث */
export function ownPapersWhere(user: CurrentUser): Prisma.ResearchPaperWhereInput {
  return {
    OR: [
      { createdById: user.id },
      { mainResearcher: { userId: user.id } },
      { authors: { some: { researcher: { userId: user.id } } } },
    ],
  };
}

/** شرط الأبحاث المسموح للمستخدم برؤيتها في قائمة "الأبحاث" */
export function visiblePapersWhere(user: CurrentUser): Prisma.ResearchPaperWhereInput {
  if (can(user, "research.view_all")) return {};
  return ownPapersWhere(user);
}

export const ARCHIVE_STATUSES = ["ACCEPTED", "PUBLISHED", "ARCHIVED"] as const;

export type PaperAccess = {
  staff: boolean; // يرى كل شيء
  owner: boolean; // الباحث صاحب البحث
  reviewer: boolean; // محكم مُسند إليه
  archiveReader: boolean; // قارئ للأرشيف (بحث منشور)
  canView: boolean;
  canEditMeta: boolean;
  canUpload: boolean;
  canSeeReviews: boolean;
  canSeeAuthors: boolean;
};

export async function getPaperAccess(
  user: CurrentUser,
  paper: { id: string; status: string; createdById: string; publishedAt: Date | null },
  blindReview = true,
): Promise<PaperAccess> {
  const staff = can(user, "research.view_all");
  const ownerCount = staff
    ? 0
    : await db.researchPaper.count({ where: { id: paper.id, ...ownPapersWhere(user) } });
  const owner = ownerCount > 0;
  const reviewer =
    can(user, "reviews.perform") &&
    (await db.reviewAssignment.count({
      where: { paperId: paper.id, reviewerId: user.id, status: { notIn: ["CANCELLED", "DECLINED"] } },
    })) > 0;
  const archiveReader =
    can(user, "archive.view") && (paper.status === "PUBLISHED" || (paper.status === "ARCHIVED" && !!paper.publishedAt));
  const canView = staff || owner || reviewer || archiveReader;
  const editableByOwner = ["DRAFT", "NEEDS_REVISION"].includes(paper.status);
  return {
    staff,
    owner,
    reviewer,
    archiveReader,
    canView,
    canEditMeta: can(user, "research.edit_all") || (owner && editableByOwner),
    canUpload: can(user, "files.manage") || (owner && editableByOwner),
    canSeeReviews: can(user, "reviews.view_all"),
    canSeeAuthors: staff || owner || archiveReader || !(reviewer && blindReview),
  };
}
