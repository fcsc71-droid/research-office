"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, assertUser, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { createDatabaseBackup } from "@/lib/backup";
import { ActionError, formToObject, ok, run, type ActionResult } from "@/lib/action";

const opt = (max = 200) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const password = z
  .string()
  .min(8, "كلمة المرور 8 أحرف على الأقل")
  .max(100)
  .regex(/[A-Za-z]/, "يجب أن تحتوي كلمة المرور على حرف إنجليزي")
  .regex(/\d/, "يجب أن تحتوي كلمة المرور على رقم");

// ───────────── المستخدمون (والمحكمون) ─────────────
const userSchema = z.object({
  name: z.string().trim().min(3, "الاسم مطلوب").max(200),
  email: z.email("بريد إلكتروني غير صالح").max(200).transform((v) => v.toLowerCase().trim()),
  phone: opt(30),
  roleId: z.string().min(1, "اختر الدور"),
  academicTitle: opt(100),
  specialization: opt(200),
  institution: opt(200),
  collegeId: opt(50),
  departmentId: opt(50),
  isActive: z.string().optional(),
  password: z.string().optional(),
  redirect: z.string().optional(),
});

export async function saveUserAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const raw = formToObject(fd);
    const forReviewers = raw.redirect === "/reviewers";
    const me = forReviewers ? await assertPermission("reviewers.manage", "users.manage") : await assertPermission("users.manage");
    const data = userSchema.parse(raw);
    const role = await db.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new ActionError("الدور غير موجود");
    // من يملك إدارة المحكمين فقط لا يستطيع إنشاء مستخدمين بأدوار أخرى
    if (!me.permissions.has("users.manage") && me.roleKey !== "ADMIN" && role.key !== "REVIEWER") throw new ActionError("يمكنك إضافة محكمين فقط");
    if (role.key === "ADMIN" && me.roleKey !== "ADMIN") throw new ActionError("فقط مدير النظام يمكنه منح دور مدير النظام");
    if (data.departmentId) {
      const d = await db.department.findUnique({ where: { id: data.departmentId } });
      if (d) data.collegeId = d.collegeId;
    }
    const base = {
      name: data.name, email: data.email, phone: data.phone, roleId: role.id, academicTitle: data.academicTitle,
      specialization: data.specialization, institution: data.institution, collegeId: data.collegeId, departmentId: data.departmentId,
    };
    if (id) {
      if (id === me.id && data.isActive !== "on") throw new ActionError("لا يمكنك تعطيل حسابك الحالي");
      const target = await db.user.findUnique({ where: { id }, include: { role: true } });
      if (!target) throw new ActionError("المستخدم غير موجود");
      if (target.role.key === "ADMIN" && me.roleKey !== "ADMIN") throw new ActionError("لا يمكنك تعديل حساب مدير النظام");
      const pass = data.password ? password.parse(data.password) : null;
      await db.user.update({
        where: { id },
        data: { ...base, isActive: data.isActive === "on", ...(pass ? { passwordHash: await hashPassword(pass), failedLogins: 0, lockedUntil: null } : {}) },
      });
      if (data.isActive !== "on" || pass) await db.session.deleteMany({ where: { userId: id } });
      await audit({ userId: me.id, action: "UPDATE", entity: "User", entityId: id, summary: `تعديل المستخدم ${data.name}${pass ? " (مع تغيير كلمة المرور)" : ""}` });
      return ok("تم حفظ بيانات المستخدم", forReviewers ? "/reviewers" : undefined);
    }
    const pass = password.parse(data.password ?? "");
    const u = await db.user.create({ data: { ...base, isActive: true, passwordHash: await hashPassword(pass) } });
    await audit({ userId: me.id, action: "CREATE", entity: "User", entityId: u.id, summary: `إنشاء المستخدم ${u.name} (${role.name})` });
    return ok("تم إنشاء المستخدم بنجاح", forReviewers ? "/reviewers" : undefined);
  });
}

export async function toggleUserActiveAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("users.manage", "reviewers.manage");
    if (id === me.id) throw new ActionError("لا يمكنك تعطيل حسابك الحالي");
    const u = await db.user.findUnique({ where: { id }, include: { role: true } });
    if (!u) throw new ActionError("المستخدم غير موجود");
    if (u.role.key === "ADMIN" && me.roleKey !== "ADMIN") throw new ActionError("لا يمكنك تعطيل مدير النظام");
    if (!me.permissions.has("users.manage") && me.roleKey !== "ADMIN" && u.role.key !== "REVIEWER") throw new ActionError("ليست لديك صلاحية");
    await db.user.update({ where: { id }, data: { isActive: !u.isActive } });
    if (u.isActive) await db.session.deleteMany({ where: { userId: id } });
    await audit({ userId: me.id, action: "UPDATE", entity: "User", entityId: id, summary: `${u.isActive ? "تعطيل" : "تفعيل"} حساب ${u.name}` });
    return ok(u.isActive ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
  });
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("users.manage");
    if (id === me.id) throw new ActionError("لا يمكنك حذف حسابك الحالي");
    const u = await db.user.findUnique({ where: { id }, include: { role: true } });
    if (!u) throw new ActionError("المستخدم غير موجود");
    if (u.role.key === "ADMIN" && (await db.user.count({ where: { role: { key: "ADMIN" }, isActive: true } })) <= 1)
      throw new ActionError("لا يمكن حذف آخر مدير للنظام");
    try {
      await db.user.delete({ where: { id } });
    } catch {
      throw new ActionError("لا يمكن حذف مستخدم لديه سجلات مرتبطة (أبحاث، تحكيم، ملفات). يمكنك تعطيل الحساب بدلاً من ذلك");
    }
    await audit({ userId: me.id, action: "DELETE", entity: "User", entityId: id, summary: `حذف المستخدم ${u.name}` });
    return ok("تم حذف المستخدم");
  });
}

// ───────────── الأدوار والصلاحيات ─────────────
export async function saveRolePermissionsAction(roleId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("roles.manage");
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new ActionError("الدور غير موجود");
    if (role.key === "ADMIN") throw new ActionError("صلاحيات مدير النظام كاملة ولا يمكن تعديلها");
    const codes = fd.getAll("perm").map(String);
    const perms = await db.permission.findMany({ where: { code: { in: codes } } });
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId } }),
      db.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) }),
    ]);
    await audit({ userId: me.id, action: "PERMISSIONS", entity: "Role", entityId: roleId, summary: `تحديث صلاحيات الدور ${role.name}`, details: { permissions: codes } });
    return ok(`تم حفظ صلاحيات دور "${role.name}"`);
  });
}

// ───────────── الهيكل الأكاديمي ─────────────
const nameSchema = z.string().trim().min(2, "الاسم مطلوب").max(200);

export async function saveCollegeAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("structure.manage");
    const data = z.object({ name: nameSchema, code: opt(20), description: opt(500) }).parse(formToObject(fd));
    const c = id ? await db.college.update({ where: { id }, data }) : await db.college.create({ data });
    await audit({ userId: me.id, action: id ? "UPDATE" : "CREATE", entity: "College", entityId: c.id, summary: `${id ? "تعديل" : "إضافة"} الكلية ${c.name}` });
    return ok(id ? "تم حفظ الكلية" : "تمت إضافة الكلية");
  });
}

export async function deleteCollegeAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("structure.manage");
    const c = await db.college.findUnique({ where: { id }, include: { _count: { select: { departments: true, papers: true } } } });
    if (!c) throw new ActionError("الكلية غير موجودة");
    if (c._count.departments || c._count.papers) throw new ActionError("لا يمكن حذف كلية تحتوي على أقسام أو أبحاث");
    await db.college.delete({ where: { id } });
    await audit({ userId: me.id, action: "DELETE", entity: "College", entityId: id, summary: `حذف الكلية ${c.name}` });
    return ok("تم حذف الكلية");
  });
}

export async function saveDepartmentAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("structure.manage");
    const data = z.object({ name: nameSchema, code: opt(20), collegeId: z.string().min(1, "اختر الكلية") }).parse(formToObject(fd));
    const d = id ? await db.department.update({ where: { id }, data }) : await db.department.create({ data });
    await audit({ userId: me.id, action: id ? "UPDATE" : "CREATE", entity: "Department", entityId: d.id, summary: `${id ? "تعديل" : "إضافة"} القسم ${d.name}` });
    return ok(id ? "تم حفظ القسم" : "تمت إضافة القسم");
  });
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("structure.manage");
    const d = await db.department.findUnique({ where: { id }, include: { _count: { select: { papers: true, researchers: true } } } });
    if (!d) throw new ActionError("القسم غير موجود");
    if (d._count.papers || d._count.researchers) throw new ActionError("لا يمكن حذف قسم مرتبط بأبحاث أو باحثين");
    await db.department.delete({ where: { id } });
    await audit({ userId: me.id, action: "DELETE", entity: "Department", entityId: id, summary: `حذف القسم ${d.name}` });
    return ok("تم حذف القسم");
  });
}

export async function saveCategoryAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("structure.manage");
    const data = z.object({ name: nameSchema, description: opt(500) }).parse(formToObject(fd));
    const c = id ? await db.researchCategory.update({ where: { id }, data }) : await db.researchCategory.create({ data });
    await audit({ userId: me.id, action: id ? "UPDATE" : "CREATE", entity: "ResearchCategory", entityId: c.id, summary: `${id ? "تعديل" : "إضافة"} التخصص ${c.name}` });
    return ok(id ? "تم حفظ التخصص" : "تمت إضافة التخصص");
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("structure.manage");
    const c = await db.researchCategory.findUnique({ where: { id }, include: { _count: { select: { papers: true } } } });
    if (!c) throw new ActionError("التخصص غير موجود");
    if (c._count.papers) throw new ActionError("لا يمكن حذف تخصص مرتبط بأبحاث");
    await db.researchCategory.delete({ where: { id } });
    await audit({ userId: me.id, action: "DELETE", entity: "ResearchCategory", entityId: id, summary: `حذف التخصص ${c.name}` });
    return ok("تم حذف التخصص");
  });
}

// ───────────── الإعدادات والنسخ الاحتياطي ─────────────
export async function saveSettingsAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("settings.manage");
    const raw = formToObject(fd);
    const bool = (k: string) => raw[k] === "on";
    const data = z
      .object({
        universityName: z.string().trim().min(2).max(200),
        officeName: z.string().trim().min(2).max(200),
        referencePrefix: z.string().trim().min(2).max(10).regex(/^[A-Za-z]+$/, "البادئة حروف إنجليزية فقط"),
        maxUploadMb: z.coerce.number().int().min(1).max(50, "الحد الأقصى 50 م.ب"),
        defaultReviewDays: z.coerce.number().int().min(1).max(120),
        deadlineReminderDays: z.coerce.number().int().min(1).max(30),
      })
      .parse(raw);
    const values = {
      ...data,
      referencePrefix: data.referencePrefix.toUpperCase(),
      watermarkInExports: bool("watermarkInExports"),
      watermarkOnDownloads: bool("watermarkOnDownloads"),
      blindReview: bool("blindReview"),
      allowResearcherSelfSubmit: bool("allowResearcherSelfSubmit"),
    } satisfies typeof DEFAULT_SETTINGS;
    await saveSettings(values);
    await audit({ userId: me.id, action: "SETTINGS", entity: "SystemSetting", summary: "تحديث إعدادات النظام", details: values });
    return ok("تم حفظ الإعدادات");
  });
}

export async function createBackupAction(): Promise<ActionResult> {
  return run(async () => {
    const me = await assertPermission("settings.manage");
    try {
      const name = await createDatabaseBackup();
      await audit({ userId: me.id, action: "BACKUP", entity: "System", summary: `إنشاء نسخة احتياطية ${name}` });
      return ok("تم إنشاء النسخة الاحتياطية بنجاح");
    } catch (e) {
      throw new ActionError(`فشل إنشاء النسخة الاحتياطية: ${(e as Error).message.slice(0, 200)}`);
    }
  });
}

// ───────────── الملف الشخصي ─────────────
export async function updateProfileAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const data = z.object({ name: z.string().trim().min(3, "الاسم مطلوب").max(200), phone: opt(30) }).parse(formToObject(fd));
    await db.user.update({ where: { id: me.id }, data });
    if (me.researcherId) await db.researcher.update({ where: { id: me.researcherId }, data: { fullName: data.name, phone: data.phone } });
    await audit({ userId: me.id, action: "UPDATE", entity: "User", entityId: me.id, summary: "تحديث الملف الشخصي" });
    return ok("تم تحديث الملف الشخصي");
  });
}

export async function changePasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const data = z
      .object({ current: z.string().min(1, "أدخل كلمة المرور الحالية"), next: password, confirm: z.string() })
      .refine((d) => d.next === d.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] })
      .parse(formToObject(fd));
    const u = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(data.current, u.passwordHash))) throw new ActionError("كلمة المرور الحالية غير صحيحة");
    await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(data.next) } });
    await audit({ userId: me.id, action: "PASSWORD", entity: "User", entityId: me.id, summary: "تغيير كلمة المرور" });
    return ok("تم تغيير كلمة المرور بنجاح");
  });
}

// ───────────── الإشعارات ─────────────
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    await db.notification.updateMany({ where: { id, userId: me.id }, data: { readAt: new Date() } });
    return ok("تم");
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    await db.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
    return ok("تم تعليم جميع الإشعارات كمقروءة");
  });
}

export async function deleteReadNotificationsAction(): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const r = await db.notification.deleteMany({ where: { userId: me.id, readAt: { not: null } } });
    return ok(`تم حذف ${r.count} إشعار مقروء`);
  });
}
