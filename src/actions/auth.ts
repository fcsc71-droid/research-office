"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, verifyPassword, getClientIp } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";

const loginSchema = z.object({
  email: z.email("البريد الإلكتروني غير صالح").max(200).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "كلمة المرور مطلوبة").max(200),
  next: z.string().optional(),
});

// حماية بسيطة من محاولات التخمين على مستوى عنوان IP (بالذاكرة)
const ipAttempts = new Map<string, { count: number; until: number }>();

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("بيانات الدخول غير صالحة", z.flattenError(parsed.error).fieldErrors);
  const { email, password, next } = parsed.data;

  const ip = (await getClientIp()) ?? "local";
  const rec = ipAttempts.get(ip);
  if (rec && rec.count >= 20 && rec.until > Date.now()) return fail("محاولات كثيرة. حاول لاحقاً");

  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return fail("تم قفل الحساب مؤقتاً بسبب محاولات دخول فاشلة متكررة. حاول بعد 15 دقيقة");
  }
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    ipAttempts.set(ip, { count: (rec?.count ?? 0) + 1, until: Date.now() + 15 * 60 * 1000 });
    if (user) {
      const failed = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null },
      });
      await audit({ userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, summary: "محاولة دخول بكلمة مرور خاطئة" });
    }
    return fail("البريد الإلكتروني أو كلمة المرور غير صحيحة");
  }
  if (!user.isActive) return fail("هذا الحساب معطل. تواصل مع مدير النظام");

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  ipAttempts.delete(ip);
  await createSession(user.id);
  await audit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, summary: "تسجيل دخول ناجح" });
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(target);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await audit({ userId: user.id, action: "LOGOUT", entity: "User", entityId: user.id, summary: "تسجيل خروج" });
  await destroySession();
  redirect("/login");
}
