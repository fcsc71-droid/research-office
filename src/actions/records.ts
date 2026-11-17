"use server";
/**
 * إجراءات وحدات الإنتاج العلمي: المشاريع البحثية، المؤتمرات والأنشطة، المجلات، التعاون البحثي، الجوائز.
 * كل سجل يضيفه عضو هيئة التدريس يكون «بانتظار الاعتماد» حتى يراجعه مكتب البحث العلمي،
 * ولا تُحتسب في التقارير الرسمية إلا السجلات المعتمدة.
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { assertUser, can, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, usersWithPermission } from "@/lib/notify";
import { saveFormAttachments, type EntityType } from "@/lib/attachments";
import { deleteStored } from "@/lib/storage";
import { ActionError, formToObject, ok, run, type ActionResult } from "@/lib/action";
import {
  AwardType, CollaborationType, EventScope, EventType, IndexingType, ParticipationRole, PartnerType, ProjectStatus, Quartile,
} from "@/generated/prisma/enums";
import type { PermissionCode } from "@/lib/constants";

const opt = (max = 300) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const date = (msg = "التاريخ مطلوب") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg).transform((v) => new Date(v + "T12:00:00"));
const optDate = z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T12:00:00") : null));
const optInt = z.string().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 0), "رقم غير صالح");

async function requireManageOrOwn(manage: PermissionCode) {
  const user = await assertUser();
  const manager = can(user, manage);
  if (!manager && !can(user, "records.submit_own")) throw new ActionError("ليست لديك صلاحية لإضافة هذا السجل");
  if (!manager && !user.researcherId) throw new ActionError("حسابك غير مرتبط بملف عضو هيئة تدريس");
  return { user, manager };
}

/** حالة الاعتماد الأولية: المعتمِد يُعتمد سجله مباشرة، وغيره ينتظر المراجعة */
function initialApproval(user: CurrentUser) {
  return can(user, "records.approve") ? ("APPROVED" as const) : ("PENDING" as const);
}

async function notifyApprovers(user: CurrentUser, title: string, body: string, link: string) {
  if (can(user, "records.approve")) return;
  await notify(await usersWithPermission("records.approve"), { type: "NEW_SUBMISSION", title, body, link }, user.id);
}

// ───────────────────────── المشاريع البحثية ─────────────────────────
const projectSchema = z.object({
  title: z.string().trim().min(5, "عنوان المشروع مطلوب").max(500),
  leadId: z.string().optional(),
  departmentId: opt(50),
  objectives: opt(5000),
  summary: opt(8000),
  startDate: optDate,
  expectedEndDate: optDate,
  status: z.enum(ProjectStatus).catch("PROPOSAL"),
  expectedOutputs: opt(4000),
  actualOutputs: opt(4000),
  partners: opt(1000),
  reportEveryMonths: z.string().optional().transform((v) => (v === "3" || v === "6" ? Number(v) : null)),
  members: z.array(z.string()).optional().default([]),
  externalMembers: z.string().max(2000).optional().transform((v) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20)),
});

async function canEditProject(user: CurrentUser, p: { createdById: string; approval: string; lead: { userId: string | null } }) {
  if (can(user, "projects.manage")) return true;
  return (p.createdById === user.id || p.lead.userId === user.id) && p.approval !== "APPROVED";
}

export async function saveProjectAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, manager } = await requireManageOrOwn("projects.manage");
    const d = projectSchema.parse(formToObject(fd));
    const leadId = manager ? d.leadId : user.researcherId!;
    if (!leadId) throw new z.ZodError([{ code: "custom", path: ["leadId"], message: "اختر الباحث الرئيسي", input: "" }]);
    const lead = await db.researcher.findUnique({ where: { id: leadId } });
    if (!lead) throw new ActionError("الباحث الرئيسي غير موجود");
    if (d.startDate && d.expectedEndDate && d.expectedEndDate < d.startDate) throw new ActionError("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
    const memberRows = await db.researcher.findMany({ where: { id: { in: d.members.filter((m) => m !== leadId) } } });
    const members = [
      ...memberRows.map((m) => ({ researcherId: m.id, name: m.fullName, role: "عضو فريق" })),
      ...d.externalMembers.map((n) => ({ researcherId: null, name: n.slice(0, 200), role: "عضو من خارج المعهد" })),
    ];
    const status = manager ? d.status : (["PROPOSAL", "IN_PROGRESS", "COMPLETED", "PUBLISHED"].includes(d.status) ? d.status : "PROPOSAL");
    const data = {
      title: d.title, leadId, departmentId: d.departmentId ?? lead.departmentId, objectives: d.objectives, summary: d.summary,
      startDate: d.startDate, expectedEndDate: d.expectedEndDate, status, expectedOutputs: d.expectedOutputs,
      actualOutputs: d.actualOutputs, partners: d.partners, reportEveryMonths: d.reportEveryMonths,
      nextReportDue: d.reportEveryMonths && d.startDate ? nextDue(d.startDate, d.reportEveryMonths) : null,
    };
    let projectId = id;
    if (id) {
      const p = await db.researchProject.findUnique({ where: { id }, include: { lead: true } });
      if (!p || !(await canEditProject(user, p))) throw new ActionError("لا يمكنك تعديل هذا المشروع");
      await db.$transaction([
        db.projectMember.deleteMany({ where: { projectId: id } }),
        db.researchProject.update({
          where: { id },
          data: { ...data, members: { create: members }, ...(p.approval === "RETURNED" ? { approval: "PENDING" as const } : {}) },
        }),
      ]);
      await audit({ userId: user.id, action: "UPDATE", entity: "ResearchProject", entityId: id, summary: `تعديل المشروع البحثي: ${d.title}` });
    } else {
      const p = await db.researchProject.create({
        data: { ...data, createdById: user.id, approval: initialApproval(user), members: { create: members } },
      });
      projectId = p.id;
      await audit({ userId: user.id, action: "CREATE", entity: "ResearchProject", entityId: p.id, summary: `إضافة المشروع البحثي: ${d.title}` });
      await notifyApprovers(user, "مشروع بحثي جديد بانتظار الاعتماد", d.title, `/projects/${p.id}`);
    }
    await saveFormAttachments(fd, "files", "PROJECT", projectId!, user);
    return ok(id ? "تم حفظ المشروع" : "تمت إضافة المشروع البحثي", `/projects/${projectId}`);
  });
}

function nextDue(from: Date, months: number) {
  const d = new Date(Math.max(from.getTime(), Date.now()));
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function addProjectReportAction(projectId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const p = await db.researchProject.findUnique({ where: { id: projectId }, include: { lead: true, members: { include: { researcher: true } } } });
    if (!p) throw new ActionError("المشروع غير موجود");
    const isMember = p.lead.userId === user.id || p.members.some((m) => m.researcher?.userId === user.id);
    if (!isMember && !can(user, "projects.manage")) throw new ActionError("ليست لديك صلاحية إضافة تقرير لهذا المشروع");
    const d = z.object({
      period: z.string().trim().min(2, "حدد الفترة").max(100),
      progress: z.coerce.number().int().min(0).max(100),
      body: z.string().trim().min(10, "اكتب ملخص الإنجاز").max(8000),
    }).parse(formToObject(fd));
    await db.projectReport.create({ data: { projectId, ...d, createdById: user.id } });
    await db.researchProject.update({
      where: { id: projectId },
      data: {
        reportReminderSentAt: null,
        ...(p.reportEveryMonths ? { nextReportDue: nextDue(new Date(), p.reportEveryMonths) } : {}),
        ...(d.progress === 100 && p.status === "IN_PROGRESS" ? { status: "COMPLETED" as const } : {}),
      },
    });
    await saveFormAttachments(fd, "files", "PROJECT", projectId, user);
    await audit({ userId: user.id, action: "CREATE", entity: "ResearchProject", entityId: projectId, summary: `تقرير إنجاز (${d.period}) للمشروع ${p.title}` });
    await notify(await usersWithPermission("projects.manage"), { type: "SYSTEM", title: "تقرير إنجاز جديد لمشروع بحثي", body: `${p.title} — ${d.period} (${d.progress}%)`, link: `/projects/${projectId}` }, user.id);
    return ok("تم إرسال تقرير الإنجاز");
  });
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const p = await db.researchProject.findUnique({ where: { id }, include: { lead: true } });
    if (!p || !(await canEditProject(user, p))) throw new ActionError("لا يمكنك حذف هذا المشروع");
    await deleteEntityAttachments("PROJECT", id);
    await db.researchProject.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "ResearchProject", entityId: id, summary: `حذف المشروع ${p.title}` });
    return ok("تم حذف المشروع", "/projects");
  });
}

// ───────────────────────── المؤتمرات والأنشطة ─────────────────────────
const eventSchema = z.object({
  name: z.string().trim().min(3, "اسم الفعالية مطلوب").max(300),
  type: z.enum(EventType, { error: "نوع الفعالية مطلوب" }),
  scope: z.enum(EventScope).catch("LOCAL"),
  organizer: opt(300),
  location: opt(300),
  startDate: date("تاريخ الانعقاد مطلوب"),
  endDate: optDate,
  description: opt(5000),
  url: opt(500).refine((v) => !v || /^https?:\/\//i.test(v), "الرابط يجب أن يبدأ بـ http"),
  attendeesCount: optInt,
  participants: z.array(z.string()).optional().default([]),
  role: z.enum(ParticipationRole).catch("ATTENDANCE"),
  paperTitle: opt(500),
  institute: z.string().optional(),
});

export async function saveEventAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, manager } = await requireManageOrOwn("events.manage");
    const d = eventSchema.parse(formToObject(fd));
    const organizedByInstitute = manager && d.institute === "1";
    const ids = manager ? d.participants : [...new Set([user.researcherId!, ...d.participants])];
    if (!organizedByInstitute && ids.length === 0) throw new ActionError("أضف مشاركاً واحداً على الأقل من أعضاء المعهد");
    const data = {
      name: d.name, type: d.type, scope: d.scope, organizer: organizedByInstitute ? (d.organizer ?? "المعهد") : d.organizer,
      location: d.location, startDate: d.startDate, endDate: d.endDate, description: d.description, url: d.url,
      attendeesCount: d.attendeesCount, organizedByInstitute,
    };
    const participants = ids.map((researcherId) => ({ researcherId, role: organizedByInstitute ? ("ORGANIZER" as const) : d.role, paperTitle: d.paperTitle }));
    let eventId = id;
    if (id) {
      const e = await db.scientificEvent.findUnique({ where: { id } });
      if (!e || (!manager && (e.createdById !== user.id || e.approval === "APPROVED"))) throw new ActionError("لا يمكنك تعديل هذا السجل");
      await db.$transaction([
        db.eventParticipant.deleteMany({ where: { eventId: id } }),
        db.scientificEvent.update({ where: { id }, data: { ...data, participants: { create: participants }, ...(e.approval === "RETURNED" ? { approval: "PENDING" as const } : {}) } }),
      ]);
      await audit({ userId: user.id, action: "UPDATE", entity: "ScientificEvent", entityId: id, summary: `تعديل الفعالية: ${d.name}` });
    } else {
      const e = await db.scientificEvent.create({ data: { ...data, createdById: user.id, approval: initialApproval(user), participants: { create: participants } } });
      eventId = e.id;
      await audit({ userId: user.id, action: "CREATE", entity: "ScientificEvent", entityId: e.id, summary: `إضافة ${organizedByInstitute ? "نشاط علمي" : "مشاركة"}: ${d.name}` });
      if (organizedByInstitute && e.approval === "APPROVED" && e.startDate > new Date()) {
        // الإعلان عن مؤتمر أو ندوة جديدة لجميع المستخدمين
        const all = await db.user.findMany({ where: { isActive: true }, select: { id: true } });
        await notify(all.map((u) => u.id), { type: "SYSTEM", title: "إعلان عن نشاط علمي جديد", body: `${d.name} — ${d.startDate.toISOString().slice(0, 10)}`, link: "/activities" }, user.id);
      }
      await notifyApprovers(user, "مشاركة علمية جديدة بانتظار الاعتماد", d.name, "/events?approval=PENDING");
    }
    await saveFormAttachments(fd, "files", "EVENT", eventId!, user);
    return ok(id ? "تم حفظ التعديلات" : "تمت الإضافة بنجاح");
  });
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const e = await db.scientificEvent.findUnique({ where: { id } });
    if (!e || (!can(user, "events.manage") && (e.createdById !== user.id || e.approval === "APPROVED"))) throw new ActionError("لا يمكنك حذف هذا السجل");
    await deleteEntityAttachments("EVENT", id);
    await db.scientificEvent.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "ScientificEvent", entityId: id, summary: `حذف الفعالية ${e.name}` });
    return ok("تم الحذف");
  });
}

// ───────────────────────── المجلات العلمية ─────────────────────────
export async function saveJournalAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "journals.manage")) throw new ActionError("ليست لديك صلاحية إدارة المجلات");
    const d = z.object({
      name: z.string().trim().min(2, "اسم المجلة مطلوب").max(300),
      publisher: opt(300),
      issn: opt(20).refine((v) => !v || /^\d{4}-\d{3}[\dXx]$/.test(v), "صيغة ISSN غير صحيحة (مثال: 1234-567X)"),
      url: opt(500).refine((v) => !v || /^https?:\/\//i.test(v), "الرابط يجب أن يبدأ بـ http"),
      indexing: z.enum(IndexingType).catch("NONE"),
      quartile: z.enum(Quartile).catch("NONE"),
      field: opt(200),
      indexingVerified: z.string().optional(),
    }).parse(formToObject(fd));
    const verified = d.indexingVerified === "on";
    const data = { ...d, issn: d.issn?.toUpperCase() ?? null, indexingVerified: verified, verifiedAt: verified ? new Date() : null };
    const j = id ? await db.journal.update({ where: { id }, data }) : await db.journal.create({ data });
    await audit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Journal", entityId: j.id, summary: `${id ? "تعديل" : "إضافة"} المجلة ${j.name}` });
    return ok(id ? "تم حفظ المجلة" : "تمت إضافة المجلة");
  });
}

export async function deleteJournalAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "journals.manage")) throw new ActionError("ليست لديك صلاحية");
    const j = await db.journal.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Journal", entityId: id, summary: `حذف المجلة ${j.name}` });
    return ok("تم حذف المجلة");
  });
}

// ───────────────────────── التعاون البحثي ─────────────────────────
export async function saveCollaborationAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "collaborations.manage")) throw new ActionError("ليست لديك صلاحية إدارة التعاون البحثي");
    const d = z.object({
      partnerName: z.string().trim().min(2, "اسم الجهة مطلوب").max(300),
      partnerType: z.enum(PartnerType, { error: "نوع الجهة مطلوب" }),
      type: z.enum(CollaborationType, { error: "نوع التعاون مطلوب" }),
      title: z.string().trim().min(3, "العنوان مطلوب").max(500),
      description: opt(5000),
      startDate: optDate,
      endDate: optDate,
      coordinator: opt(200),
    }).parse(formToObject(fd));
    const c = id ? await db.collaboration.update({ where: { id }, data: d }) : await db.collaboration.create({ data: { ...d, createdById: user.id } });
    await saveFormAttachments(fd, "files", "COLLABORATION", c.id, user);
    await audit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Collaboration", entityId: c.id, summary: `${id ? "تعديل" : "إضافة"} تعاون مع ${c.partnerName}` });
    return ok(id ? "تم الحفظ" : "تمت إضافة التعاون البحثي");
  });
}

export async function deleteCollaborationAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "collaborations.manage")) throw new ActionError("ليست لديك صلاحية");
    await deleteEntityAttachments("COLLABORATION", id);
    const c = await db.collaboration.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Collaboration", entityId: id, summary: `حذف التعاون مع ${c.partnerName}` });
    return ok("تم الحذف");
  });
}

// ───────────────────────── الجوائز والتكريم ─────────────────────────
export async function saveAwardAction(id: string | null, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, manager } = await requireManageOrOwn("awards.manage");
    const d = z.object({
      researcherId: z.string().optional(),
      title: z.string().trim().min(3, "اسم الجائزة مطلوب").max(300),
      type: z.enum(AwardType, { error: "نوع الجائزة مطلوب" }),
      grantor: opt(300),
      date: date(),
      description: opt(3000),
    }).parse(formToObject(fd));
    const researcherId = manager ? d.researcherId : user.researcherId!;
    if (!researcherId || !(await db.researcher.findUnique({ where: { id: researcherId } }))) throw new ActionError("اختر عضو هيئة التدريس");
    const data = { researcherId, title: d.title, type: d.type, grantor: d.grantor, date: d.date, description: d.description };
    let awardId = id;
    if (id) {
      const w = await db.award.findUnique({ where: { id } });
      if (!w || (!manager && (w.createdById !== user.id || w.approval === "APPROVED"))) throw new ActionError("لا يمكنك تعديل هذا السجل");
      await db.award.update({ where: { id }, data: { ...data, ...(w.approval === "RETURNED" ? { approval: "PENDING" as const } : {}) } });
    } else {
      const w = await db.award.create({ data: { ...data, createdById: user.id, approval: initialApproval(user) } });
      awardId = w.id;
      await notifyApprovers(user, "جائزة جديدة بانتظار الاعتماد", d.title, "/awards?approval=PENDING");
    }
    await saveFormAttachments(fd, "files", "AWARD", awardId!, user);
    await audit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Award", entityId: awardId, summary: `${id ? "تعديل" : "إضافة"} الجائزة: ${d.title}` });
    return ok(id ? "تم الحفظ" : "تمت إضافة الجائزة");
  });
}

export async function deleteAwardAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const w = await db.award.findUnique({ where: { id } });
    if (!w || (!can(user, "awards.manage") && (w.createdById !== user.id || w.approval === "APPROVED"))) throw new ActionError("لا يمكنك حذف هذا السجل");
    await deleteEntityAttachments("AWARD", id);
    await db.award.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entity: "Award", entityId: id, summary: `حذف الجائزة ${w.title}` });
    return ok("تم الحذف");
  });
}

// ───────────────────────── الاعتماد والإرجاع ─────────────────────────
type Approvable = "project" | "event" | "award";

export async function decideRecordAction(kind: Approvable, id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "records.approve")) throw new ActionError("ليست لديك صلاحية اعتماد السجلات");
    const d = z.object({ decision: z.enum(["APPROVED", "RETURNED"]), note: opt(2000) }).parse(formToObject(fd));
    if (d.decision === "RETURNED" && !d.note) throw new ActionError("اكتب البيانات المطلوب استكمالها عند الإرجاع");
    let title = "";
    let ownerUserIds: (string | null)[] = [];
    let link = "/";
    if (kind === "project") {
      const cur = await db.researchProject.findUniqueOrThrow({ where: { id } });
      // اعتماد المقترح البحثي ينقله إلى مرحلة «معتمد»
      const promote = d.decision === "APPROVED" && ["PROPOSAL", "UNDER_REVIEW"].includes(cur.status);
      const p = await db.researchProject.update({
        where: { id },
        data: { approval: d.decision, approvalNote: d.note, ...(promote ? { status: "APPROVED" as const } : {}) },
        include: { lead: true },
      });
      title = p.title; ownerUserIds = [p.lead.userId, p.createdById]; link = `/projects/${id}`;
    } else if (kind === "event") {
      const e = await db.scientificEvent.update({ where: { id }, data: { approval: d.decision, approvalNote: d.note }, include: { participants: { include: { researcher: true } } } });
      title = e.name; ownerUserIds = [e.createdById, ...e.participants.map((p) => p.researcher.userId)]; link = e.organizedByInstitute ? "/activities" : "/events";
    } else {
      const w = await db.award.update({ where: { id }, data: { approval: d.decision, approvalNote: d.note }, include: { researcher: true } });
      title = w.title; ownerUserIds = [w.createdById, w.researcher.userId]; link = "/awards";
    }
    await audit({ userId: user.id, action: "STATUS_CHANGE", entity: kind, entityId: id, summary: `${d.decision === "APPROVED" ? "اعتماد" : "إرجاع للاستكمال"}: ${title}` });
    await notify(ownerUserIds, {
      type: "DECISION",
      title: d.decision === "APPROVED" ? "تم اعتماد سجلك العلمي" : "أعيد سجلك العلمي لاستكمال البيانات",
      body: d.note ? `${title}\n${d.note}` : title,
      link,
    }, user.id);
    return ok(d.decision === "APPROVED" ? "تم الاعتماد" : "تمت إعادة السجل لاستكمال البيانات");
  });
}

export async function deleteAttachmentAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const a = await db.attachment.findUnique({ where: { id } });
    if (!a) throw new ActionError("المرفق غير موجود");
    const managePerm: Record<string, PermissionCode> = {
      PROJECT: "projects.manage", EVENT: "events.manage", AWARD: "awards.manage", COLLABORATION: "collaborations.manage", RESEARCHER_CV: "researchers.manage",
    };
    if (a.uploadedById !== user.id && !can(user, managePerm[a.entityType])) throw new ActionError("ليست لديك صلاحية حذف هذا المرفق");
    await db.attachment.delete({ where: { id } });
    await deleteStored(a.storageKey).catch(() => {});
    await audit({ userId: user.id, action: "DELETE", entity: "Attachment", entityId: id, summary: `حذف المرفق ${a.originalName}` });
    return ok("تم حذف المرفق");
  });
}

async function deleteEntityAttachments(entityType: EntityType, entityId: string) {
  const list = await db.attachment.findMany({ where: { entityType, entityId } });
  await db.attachment.deleteMany({ where: { entityType, entityId } });
  await Promise.all(list.map((a) => deleteStored(a.storageKey).catch(() => {})));
}
