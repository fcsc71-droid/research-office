import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { UploadError } from "@/lib/storage";

export type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  redirectTo?: string;
  ts?: number;
};

export class ActionError extends Error {}

export function ok(message: string, redirectTo?: string): ActionResult {
  return { ok: true, message, redirectTo, ts: Date.now() };
}
export function fail(error: string, fieldErrors?: ActionResult["fieldErrors"]): ActionResult {
  return { ok: false, error, fieldErrors, ts: Date.now() };
}

/** يغلف منطق الإجراء ويحوّل الأخطاء المعروفة إلى رسائل عربية واضحة */
export async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof z.ZodError) {
      return fail("يرجى تصحيح الحقول المظللة", z.flattenError(e).fieldErrors as Record<string, string[]>);
    }
    if (e instanceof AuthError || e instanceof ActionError || e instanceof UploadError) return fail(e.message);
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return fail("القيمة المدخلة مستخدمة مسبقاً (تكرار في حقل فريد)");
    if (code === "P2003" || code === "P2014") return fail("لا يمكن تنفيذ العملية لوجود بيانات مرتبطة بهذا السجل");
    if (code === "P2025") return fail("السجل المطلوب غير موجود");
    // إعادة رمي أخطاء التوجيه الخاصة بـ Next.js
    if ((e as { digest?: string })?.digest?.startsWith?.("NEXT_")) throw e;
    console.error(e);
    return fail("حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى");
  }
}

/** تحويل FormData إلى كائن (مع دعم الحقول المتعددة) */
export function formToObject(fd: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (v instanceof File) continue;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      (obj[key] = (obj[key] as unknown[]) ?? []).push(v);
    } else obj[k] = v;
  }
  return obj;
}
