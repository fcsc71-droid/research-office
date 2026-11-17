import { getCurrentUser, can } from "@/lib/auth";
import { buildTemplate } from "@/lib/import";
import { fileResponse, jsonError } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  if (!can(user, "researchers.manage") && !can(user, "research.edit_all")) return jsonError("ليست لديك صلاحية", 403);
  const type = new URL(req.url).searchParams.get("type") === "papers" ? "papers" : "researchers";
  const buf = await buildTemplate(type);
  return fileResponse(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", type === "papers" ? "قالب-البحوث-المنشورة.xlsx" : "قالب-أعضاء-هيئة-التدريس.xlsx");
}
