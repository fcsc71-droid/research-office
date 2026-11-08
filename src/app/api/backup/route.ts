import { promises as fs } from "node:fs";
import { getCurrentUser, can } from "@/lib/auth";
import { backupPath } from "@/lib/backup";
import { audit } from "@/lib/audit";
import { fileResponse, jsonError } from "@/lib/http";

// تنزيل ملف نسخة احتياطية (لمدير النظام فقط)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  if (!can(user, "settings.manage")) return jsonError("ليست لديك صلاحية", 403);
  const name = new URL(req.url).searchParams.get("name") ?? "";
  try {
    const buf = await fs.readFile(backupPath(name));
    await audit({ userId: user.id, action: "BACKUP", entity: "System", summary: `تنزيل النسخة الاحتياطية ${name}` });
    return fileResponse(buf, "application/octet-stream", name);
  } catch {
    return jsonError("الملف غير موجود", 404);
  }
}
