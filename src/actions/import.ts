"use server";
import { assertPermission, can } from "@/lib/auth";
import { importPapers, importResearchers, type ImportResult } from "@/lib/import";
import { getSettings } from "@/lib/settings";
import { ActionError, ok, run, type ActionResult } from "@/lib/action";

export type ImportActionResult = ActionResult & { result?: ImportResult };

export async function importAction(_: ImportActionResult | null, fd: FormData): Promise<ImportActionResult> {
  let result: ImportResult | undefined;
  const r = await run(async () => {
    const type = fd.get("type");
    const user = type === "researchers" ? await assertPermission("researchers.manage") : await assertPermission("research.edit_all");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("اختر ملف Excel");
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new ActionError("يجب أن يكون الملف بصيغة xlsx");
    const { maxUploadMb } = await getSettings();
    if (file.size > maxUploadMb * 1024 * 1024) throw new ActionError(`حجم الملف يتجاوز ${maxUploadMb} م.ب`);
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.subarray(0, 2).toString() !== "PK") throw new ActionError("الملف ليس ملف Excel صالحاً");
    try {
      result = type === "researchers"
        ? await importResearchers(buf, user)
        : await importPapers(buf, user, fd.get("approveNow") === "on" && can(user, "research.approve"));
    } catch (e) {
      if (e instanceof Error && !("code" in e)) throw new ActionError(e.message);
      throw e;
    }
    return ok(`تم استيراد ${result.created} سجل${result.skipped.length ? `، وتجاوز ${result.skipped.length} صف` : ""}`);
  });
  return { ...r, result };
}
