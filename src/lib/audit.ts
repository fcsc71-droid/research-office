import "server-only";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/auth";

export async function audit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        summary: params.summary,
        details: (params.details ?? undefined) as never,
        ipAddress: await getClientIp().catch(() => null),
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: "تسجيل دخول",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  LOGOUT: "تسجيل خروج",
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
  STATUS_CHANGE: "تغيير حالة",
  UPLOAD: "رفع ملف",
  DOWNLOAD: "تنزيل ملف",
  ASSIGN_REVIEWER: "تعيين محكم",
  SUBMIT_REVIEW: "تسليم تقييم",
  EXPORT: "تصدير",
  SETTINGS: "تعديل الإعدادات",
  BACKUP: "نسخ احتياطي",
  PERMISSIONS: "تعديل الصلاحيات",
  PASSWORD: "تغيير كلمة المرور",
};
