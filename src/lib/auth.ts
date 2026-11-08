import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { PermissionCode } from "@/lib/constants";

export const SESSION_COOKIE = "ro_session";
const SESSION_TTL_HOURS = 12;

function hashToken(token: string) {
  return createHash("sha256").update(token + (process.env.SESSION_SECRET ?? "")).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getClientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: await getClientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  c.delete(SESSION_COOKIE);
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadCurrentUser>>>;

async function loadCurrentUser() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
          researcher: { select: { id: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const u = session.user;
  const permissions = new Set(u.role.permissions.map((rp) => rp.permission.code));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    roleKey: u.role.key,
    roleName: u.role.name,
    researcherId: u.researcher?.id ?? null,
    permissions,
  };
}

/** المستخدم الحالي (مخزن مؤقتاً لكل طلب) */
export const getCurrentUser = cache(loadCurrentUser);

export function can(user: CurrentUser | null, perm: PermissionCode) {
  return !!user && (user.roleKey === "ADMIN" || user.permissions.has(perm));
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** يتحقق من الصلاحية على الخادم ويعيد التوجيه لصفحة "غير مصرح" عند الرفض */
export async function requirePermission(...perms: PermissionCode[]) {
  const user = await requireUser();
  if (!perms.some((p) => can(user, p))) redirect("/forbidden");
  return user;
}

export class AuthError extends Error {}

/** للاستخدام داخل Server Actions و API: يرمي خطأ بدلاً من إعادة التوجيه */
export async function assertPermission(...perms: PermissionCode[]) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("يجب تسجيل الدخول أولاً");
  if (!perms.some((p) => can(user, p))) throw new AuthError("ليست لديك صلاحية لتنفيذ هذا الإجراء");
  return user;
}
export async function assertUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("يجب تسجيل الدخول أولاً");
  return user;
}
