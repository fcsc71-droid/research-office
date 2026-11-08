import { db } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { getPaperAccess } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { readStored } from "@/lib/storage";
import { stampPdfWatermark } from "@/lib/pdf";
import { audit } from "@/lib/audit";
import { fileResponse, jsonError } from "@/lib/http";

// تنزيل/معاينة الملفات — لا يمكن الوصول للملفات مباشرة؛ يتم التحقق من الصلاحية لكل طلب
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  const { id } = await ctx.params;
  const file = await db.researchFile.findUnique({
    where: { id },
    include: { paper: { select: { id: true, status: true, createdById: true, publishedAt: true } }, assignment: { select: { reviewerId: true } } },
  });
  if (!file) return jsonError("الملف غير موجود", 404);

  const access = await getPaperAccess(user, file.paper);
  let allowed = access.canView;
  if (file.category === "REVIEW_REPORT") {
    // تقارير المحكمين سرية: لمن يملك صلاحية الاطلاع على التقييمات أو للمحكم صاحب التقرير
    allowed = can(user, "reviews.view_all") || file.assignment?.reviewerId === user.id;
  }
  if (!allowed) return jsonError("ليست لديك صلاحية الوصول لهذا الملف", 403);

  let body: Buffer;
  try {
    body = await readStored(file.storageKey);
  } catch {
    return jsonError("تعذر العثور على الملف في وحدة التخزين", 404);
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const settings = await getSettings();
  if (file.extension === "pdf" && settings.watermarkOnDownloads) {
    try {
      body = await stampPdfWatermark(body);
    } catch (e) {
      console.error("watermark stamp failed", e);
    }
  }
  if (!inline) {
    await audit({ userId: user.id, action: "DOWNLOAD", entity: "ResearchFile", entityId: file.id, summary: `تنزيل الملف ${file.originalName}` });
  }
  const safeInline = inline && (file.extension === "pdf" || file.mimeType.startsWith("image/"));
  return fileResponse(body, file.mimeType, file.originalName, safeInline);
}
