"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ActionError, formToObject, ok, run, type ActionResult } from "@/lib/action";
import { AcademicDegree, ResearcherType } from "@/generated/prisma/enums";

const opt = (max = 200) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const researcherSchema = z.object({
  fullName: z.string().trim().min(3, "الاسم الكامل مطلوب").max(200),
  universityId: z.string().trim().min(2, "الرقم الجامعي/الوظيفي مطلوب").max(50).regex(/^[\w-]+$/, "يجب أن يحتوي على أرقام وحروف فقط"),
  email: z.email("بريد إلكتروني غير صالح").max(200).transform((v) => v.toLowerCase().trim()),
  phone: opt(30).refine((v) => !v || /^[+\d\s-]{6,30}$/.test(v), "رقم هاتف غير صالح"),
  type: z.enum(ResearcherType),
  academicDegree: z.enum(AcademicDegree),
  collegeId: opt(50),
  departmentId: opt(50),
  specialization: opt(200),
  notes: opt(2000),
  createAccount: z.string().optional(),
  password: z.string().optional(),
});

async function checkDept(collegeId: string | null, departmentId: string | null) {
  if (!departmentId) return collegeId;
  const d = await db.department.findUnique({ where: { id: departmentId } });
  if (!d) throw new ActionError("القسم غير موجود");
  return d.collegeId;
}

export async function saveResearcherAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("researchers.manage");
    const data = researcherSchema.parse(formToObject(fd));
    const collegeId = await checkDept(data.collegeId, data.departmentId);
    const payload = {
      fullName: data.fullName, universityId: data.universityId, email: data.email, phone: data.phone, type: data.type,
      academicDegree: data.academicDegree, collegeId, departmentId: data.departmentId, specialization: data.specialization, notes: data.notes,
    };
    let researcher;
    if (id) {
      researcher = await db.researcher.update({ where: { id }, data: payload });
      // مزامنة اسم المستخدم المرتبط
      if (researcher.userId) await db.user.update({ where: { id: researcher.userId }, data: { name: data.fullName, phone: data.phone } });
      await audit({ userId: user.id, action: "UPDATE", entity: "Researcher", entityId: id, summary: `تعديل بيانات الباحث ${data.fullName}` });
    } else {
      researcher = await db.researcher.create({ data: payload });
      await audit({ userId: user.id, action: "CREATE", entity: "Researcher", entityId: researcher.id, summary: `إضافة الباحث ${data.fullName}` });
    }
    if (data.createAccount === "on" && !researcher.userId) {
      const pass = z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(100).parse(data.password ?? "");
      const role = await db.role.findUniqueOrThrow({ where: { key: "RESEARCHER" } });
      const existing = await db.user.findUnique({ where: { email: data.email } });
      if (existing) throw new ActionError("يوجد حساب مستخدم بنفس البريد الإلكتروني");
      const u = await db.user.create({
        data: { name: data.fullName, email: data.email, phone: data.phone, passwordHash: await hashPassword(pass), roleId: role.id, collegeId, departmentId: data.departmentId },
      });
      await db.researcher.update({ where: { id: researcher.id }, data: { userId: u.id } });
      await audit({ userId: user.id, action: "CREATE", entity: "User", entityId: u.id, summary: `إنشاء حساب دخول للباحث ${data.fullName}` });
    }
    return ok(id ? "تم حفظ بيانات الباحث" : "تمت إضافة الباحث بنجاح", `/researchers/${researcher.id}`);
  });
}

export async function deleteResearcherAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("researchers.manage");
    const r = await db.researcher.findUnique({ where: { id }, include: { _count: { select: { mainPapers: true } } } });
    if (!r) throw new ActionError("الباحث غير موجود");
    if (r._count.mainPapers > 0) throw new ActionError("لا يمكن حذف باحث مرتبط بأبحاث رئيسية. يمكنك تعديل بياناته بدلاً من ذلك");
    await db.researcher.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Researcher", entityId: id, summary: `حذف الباحث ${r.fullName}` });
    return ok("تم حذف الباحث", "/researchers");
  });
}
