import type { ResearchStatus } from "@/generated/prisma/enums";
import type { PermissionCode } from "@/lib/constants";

/** الانتقالات المسموحة بين حالات البحث والصلاحية المطلوبة لكل انتقال */
export const TRANSITIONS: Record<ResearchStatus, { to: ResearchStatus; perm: PermissionCode; label: string }[]> = {
  DRAFT: [{ to: "SUBMITTED", perm: "research.change_status", label: "تقديم البحث" }],
  SUBMITTED: [
    { to: "ADMIN_REVIEW", perm: "research.change_status", label: "بدء المراجعة الإدارية" },
    { to: "NEEDS_REVISION", perm: "research.change_status", label: "طلب تعديلات" },
    { to: "REJECTED", perm: "research.approve", label: "رفض البحث" },
  ],
  ADMIN_REVIEW: [
    { to: "UNDER_REVIEW", perm: "research.change_status", label: "إحالة للتحكيم العلمي" },
    { to: "NEEDS_REVISION", perm: "research.change_status", label: "طلب تعديلات" },
    { to: "REJECTED", perm: "research.approve", label: "رفض البحث" },
  ],
  UNDER_REVIEW: [
    { to: "NEEDS_REVISION", perm: "research.change_status", label: "طلب تعديلات" },
    { to: "ACCEPTED", perm: "research.approve", label: "قبول البحث" },
    { to: "REJECTED", perm: "research.approve", label: "رفض البحث" },
  ],
  NEEDS_REVISION: [{ to: "RESUBMITTED", perm: "research.change_status", label: "تسجيل إعادة التقديم" }],
  RESUBMITTED: [
    { to: "ADMIN_REVIEW", perm: "research.change_status", label: "مراجعة إدارية" },
    { to: "UNDER_REVIEW", perm: "research.change_status", label: "إحالة لجولة تحكيم جديدة" },
    { to: "NEEDS_REVISION", perm: "research.change_status", label: "طلب تعديلات إضافية" },
    { to: "ACCEPTED", perm: "research.approve", label: "قبول البحث" },
    { to: "REJECTED", perm: "research.approve", label: "رفض البحث" },
  ],
  ACCEPTED: [
    { to: "PUBLISHED", perm: "research.approve", label: "تسجيل النشر" },
    { to: "ARCHIVED", perm: "research.approve", label: "أرشفة" },
  ],
  REJECTED: [{ to: "ARCHIVED", perm: "research.approve", label: "أرشفة" }],
  PUBLISHED: [{ to: "ARCHIVED", perm: "research.approve", label: "أرشفة" }],
  ARCHIVED: [],
};
