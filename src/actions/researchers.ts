"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission, assertUser, hashPassword } from "@/lib/auth";
import { saveAttachment } from "@/lib/attachments";
import { notify } from "@/lib/notify";

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
  ...profileFields(),
});

function profileFields() {
  return {
    generalSpecialization: opt(200),
    jobTitle: opt(200),
    qualification: opt(200),
    qualificationYear: z.string().optional().transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 1950 && v <= 2100), "سنة غير صالحة"),
    researchInterests: z.string().max(1000).optional()
      .transform((v) => [...new Set((v ?? "").split(/[,،\n]/).map((k) => k.trim()).filter(Boolean))].slice(0, 15)),
    orcid: opt(40).refine((v) => !v || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v), "صيغة ORCID غير صحيحة (مثال: 0000-0002-1825-0097)"),
    googleScholar: opt(300).refine((v) => !v || /^https?:\/\//.test(v), "أدخل رابط ملف Google Scholar كاملاً"),
    scopusId: opt(30).refine((v) => !v || /^\d{5,15}$/.test(v), "Scopus Author ID أرقام فقط"),
    researchGate: opt(300).refine((v) => !v || /^https?:\/\//.test(v), "أدخل رابط ResearchGate كاملاً"),
  };
}

function profileData(d: { generalSpecialization: string | null; jobTitle: string | null; qualification: string | null; qualificationYear: number | null; researchInterests: string[]; orcid: string | null; googleScholar: string | null; scopusId: string | null; researchGate: string | null }) {
  return {
    generalSpecialization: d.generalSpecialization, jobTitle: d.jobTitle, qualification: d.qualification,
    qualificationYear: d.qualificationYear, researchInterests: d.researchInterests, orcid: d.orcid,
    googleScholar: d.googleScholar, scopusId: d.scopusId, researchGate: d.researchGate,
  };
}

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
      ...profileData(data),
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
    const cv = fd.get("cv");
    if (cv instanceof File && cv.size > 0) await saveAttachment("RESEARCHER_CV", researcher.id, cv, user, "السيرة الذاتية");
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

/** عضو هيئة التدريس يحدّث ملفه البحثي بنفسه */
export async function updateOwnResearchProfileAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!user.researcherId) throw new ActionError("حسابك غير مرتبط بملف باحث");
    const data = z.object({ phone: opt(30), specialization: opt(200), ...profileFields() }).parse(formToObject(fd));
    await db.researcher.update({ where: { id: user.researcherId }, data: { phone: data.phone, specialization: data.specialization, ...profileData(data) } });
    const cv = fd.get("cv");
    if (cv instanceof File && cv.size > 0) await saveAttachment("RESEARCHER_CV", user.researcherId, cv, user, "السيرة الذاتية");
    await audit({ userId: user.id, action: "UPDATE", entity: "Researcher", entityId: user.researcherId, summary: "تحديث الملف البحثي الشخصي" });
    return ok("تم تحديث ملفك البحثي");
  });
}

/** طلب تحديث البيانات من عضو هيئة التدريس (إشعار) */
export async function requestProfileUpdateAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("researchers.manage");
    const r = await db.researcher.findUnique({ where: { id } });
    if (!r?.userId) throw new ActionError("لا يوجد حساب دخول مرتبط بهذا الباحث");
    const msg = z.string().trim().max(1000).parse(fd.get("message") ?? "");
    await notify([r.userId], { type: "SYSTEM", title: "مطلوب تحديث بياناتك البحثية", body: msg || "يرجى مراجعة ملفك البحثي واستكمال البيانات الناقصة.", link: "/profile" });
    await audit({ userId: user.id, action: "UPDATE", entity: "Researcher", entityId: id, summary: `طلب تحديث بيانات ${r.fullName}` });
    return ok("تم إرسال طلب التحديث للباحث");
  });
}

/** إنشاء ملف باحث لصاحب الحساب (مثل الطالب) عند تقديم أول بحث */
export async function createOwnResearcherProfileAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (user.researcherId) return ok("ملفك البحثي موجود", "/research/new");
    const data = z.object({
      universityId: z.string().trim().min(2, "الرقم الجامعي مطلوب").max(50).regex(/^[\w-]+$/, "أرقام وحروف فقط"),
      departmentId: z.string().min(1, "اختر القسم"),
      academicDegree: z.enum(AcademicDegree),
    }).parse(formToObject(fd));
    const dept = await db.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw new ActionError("القسم غير موجود");
    const taken = await db.researcher.findFirst({ where: { OR: [{ universityId: data.universityId }, { email: user.email }] } });
    if (taken) throw new ActionError("يوجد ملف باحث بنفس الرقم الجامعي أو البريد. تواصل مع مكتب البحث العلمي لربطه بحسابك");
    const isStudent = user.roleKey === "STUDENT";
    const r = await db.researcher.create({
      data: {
        fullName: user.name, email: user.email, phone: user.phone, universityId: data.universityId, userId: user.id,
        type: isStudent ? "STUDENT" : "FACULTY", academicDegree: data.academicDegree, departmentId: dept.id, collegeId: dept.collegeId,
      },
    });
    await db.user.update({ where: { id: user.id }, data: { departmentId: dept.id, collegeId: dept.collegeId } });
    await audit({ userId: user.id, action: "CREATE", entity: "Researcher", entityId: r.id, summary: "إنشاء ملف باحث ذاتي لتقديم بحث" });
    return ok("تم إنشاء ملفك كباحث، يمكنك الآن تقديم بحثك", "/research/new");
  });
}
