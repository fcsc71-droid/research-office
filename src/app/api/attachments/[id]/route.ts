import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAttachment } from "@/lib/attachments";
import { readStored } from "@/lib/storage";
import { getSettings } from "@/lib/settings";
import { stampPdfWatermark } from "@/lib/pdf";
import { fileResponse, jsonError } from "@/lib/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  const { id } = await ctx.params;
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a) return jsonError("الملف غير موجود", 404);
  if (!(await canAccessAttachment(user, a))) return jsonError("ليست لديك صلاحية الوصول لهذا الملف", 403);
  let body: Buffer;
  try {
    body = await readStored(a.storageKey);
  } catch {
    return jsonError("تعذر العثور على الملف", 404);
  }
  if (a.extension === "pdf" && (await getSettings()).watermarkOnDownloads) {
    body = await stampPdfWatermark(body).catch(() => body);
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1" && (a.extension === "pdf" || a.mimeType.startsWith("image/"));
  return fileResponse(body, a.mimeType, a.originalName, inline);
}
