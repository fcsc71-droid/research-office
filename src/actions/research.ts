"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertUser, can, type CurrentUser } from "@/lib/auth";
import { getPaperAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notify, usersWithPermission, paperOwnerUserIds } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { deleteStored } from "@/lib/storage";
import { applyStatusChange, attachFile, generateReferenceNo } from "@/lib/research-service";
import { TRANSITIONS } from "@/lib/workflow";
import { ActionError, formToObject, ok, run, type ActionResult } from "@/lib/action";
import { ResearchLevel, ResearchType, ResearchStatus, FileCategory, CommentType } from "@/generated/prisma/enums";

const optStr = (max = 300) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optId = z.string().trim().optional().transform((v) => (v ? v : null));

const paperSchema = z.object({
  titleAr: z.string().trim().min(5, "عنوان البحث بالعربية مطلوب (5 أحرف على الأقل)").max(500),
  titleEn: optStr(500),
  abstract: z.string().trim().min(20, "الملخص مطلوب (20 حرفاً على الأقل)").max(8000),
  keywords: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((v) => [...new Set((v ?? "").split(/[,،\n]/).map((k) => k.trim()).filter(Boolean))].slice(0, 15)),
  mainResearcherId: optId,
  coAuthors: z.array(z.string()).optional().default([]),
  externalAuthors: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20)),
  collegeId: optId,
  departmentId: optId,
  categoryId: optId,
  specialization: optStr(200),
  supervisorName: optStr(200),
  type: z.enum(ResearchType, { error: "نوع البحث مطلوب" }),
  level: z.enum(ResearchLevel, { error: "مستوى البحث مطلوب" }),
  submittedAt: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T12:00:00") : null)),
  submitNow: z.string().optional(),
});

async function resolveAuthors(user: CurrentUser, data: z.infer<typeof paperSchema>) {
  let mainId = data.mainResearcherId;
  if (!can(user, "research.view_all")) {
    // الباحث لا يستطيع إنشاء بحث إلا باسمه
    if (!user.researcherId) throw new ActionError("حسابك غير مرتبط بملف باحث. تواصل مع مكتب الأبحاث");
    mainId = user.researcherId;
  }
  if (!mainId) throw new z.ZodError([{ code: "custom", path: ["mainResearcherId"], message: "اختر الباحث الرئيسي", input: "" }]);
  const main = await db.researcher.findUnique({ where: { id: mainId } });
  if (!main) throw new ActionError("الباحث الرئيسي غير موجود");
  const coIds = data.coAuthors.filter((id) => id && id !== mainId);
  const co = coIds.length ? await db.researcher.findMany({ where: { id: { in: coIds } } }) : [];
  return {
    main,
    authors: [
      { name: main.fullName, researcherId: main.id, role: "MAIN" as const, order: 0 },
      ...co.map((c, i) => ({ name: c.fullName, researcherId: c.id, role: "CO_AUTHOR" as const, order: i + 1 })),
      ...data.externalAuthors.map((n, i) => ({ name: n.slice(0, 200), researcherId: null, role: "CO_AUTHOR" as const, order: co.length + i + 1 })),
    ],
  };
}

async function validateStructure(data: { collegeId: string | null; departmentId: string | null }) {
  if (data.departmentId) {
    const d = await db.department.findUnique({ where: { id: data.departmentId } });
    if (!d) throw new ActionError("القسم غير موجود");
    if (data.collegeId && d.collegeId !== data.collegeId) throw new ActionError("القسم المختار لا يتبع الكلية المختارة");
    data.collegeId = d.collegeId;
  }
}

export async function createPaperAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "research.create")) throw new ActionError("ليست لديك صلاحية إنشاء بحث");
    const data = paperSchema.parse(formToObject(fd));
    await validateStructure(data);
    const { main, authors } = await resolveAuthors(user, data);
    const settings = await getSettings();
    const staff = can(user, "research.view_all");
    const submit = data.submitNow === "on" && (staff || settings.allowResearcherSelfSubmit);
    const file = fd.get("mainFile");

    let paper = null;
    for (let attempt = 0; attempt < 3 && !paper; attempt++) {
      try {
        paper = await db.researchPaper.create({
          data: {
            referenceNo: await generateReferenceNo(),
            titleAr: data.titleAr,
            titleEn: data.titleEn,
            abstract: data.abstract,
            keywords: data.keywords,
            mainResearcherId: main.id,
            collegeId: data.collegeId ?? main.collegeId,
            departmentId: data.departmentId ?? main.departmentId,
            categoryId: data.categoryId,
            specialization: data.specialization,
            supervisorName: data.supervisorName,
            type: data.type,
            level: data.level,
            status: "DRAFT",
            createdById: user.id,
            authors: { create: authors },
            versions: { create: { versionNo: 1, note: "النسخة الأولى", createdById: user.id } },
            statusHistory: { create: { toStatus: "DRAFT", changedById: user.id, note: "إنشاء البحث" } },
          },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e;
      }
    }
    if (!paper) throw new ActionError("تعذر توليد رقم مرجعي");
    await audit({ userId: user.id, action: "CREATE", entity: "ResearchPaper", entityId: paper.id, summary: `إنشاء البحث ${paper.referenceNo}` });

    if (file instanceof File && file.size > 0) {
      await attachFile({ paperId: paper.id, file, category: "MAIN_DOCUMENT", title: "ملف البحث الرئيسي", user });
    }
    if (submit) {
      await applyStatusChange(paper, "SUBMITTED", user, null);
      if (staff && data.submittedAt) await db.researchPaper.update({ where: { id: paper.id }, data: { submittedAt: data.submittedAt } });
    }
    return ok(`تم إنشاء البحث برقم مرجعي ${paper.referenceNo}`, `/research/${paper.id}`);
  });
}

async function loadPaperFor(user: CurrentUser, id: string) {
  const paper = await db.researchPaper.findUnique({ where: { id } });
  if (!paper) throw new ActionError("البحث غير موجود");
  const access = await getPaperAccess(user, paper);
  if (!access.canView) throw new ActionError("ليست لديك صلاحية على هذا البحث");
  return { paper, access };
}

export async function updatePaperAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const { paper, access } = await loadPaperFor(user, id);
    if (!access.canEditMeta) throw new ActionError("لا يمكن تعديل البحث في حالته الحالية أو ليست لديك الصلاحية");
    const data = paperSchema.parse(formToObject(fd));
    await validateStructure(data);
    if (!can(user, "research.view_all")) data.mainResearcherId = paper.mainResearcherId;
    else data.mainResearcherId ??= paper.mainResearcherId;
    const { main, authors } = await resolveAuthors(user, data);
    await db.$transaction([
      db.researchAuthor.deleteMany({ where: { paperId: id } }),
      db.researchPaper.update({
        where: { id },
        data: {
          titleAr: data.titleAr,
          titleEn: data.titleEn,
          abstract: data.abstract,
          keywords: data.keywords,
          mainResearcherId: main.id,
          collegeId: data.collegeId,
          departmentId: data.departmentId,
          categoryId: data.categoryId,
          specialization: data.specialization,
          supervisorName: data.supervisorName,
          type: data.type,
          level: data.level,
          ...(can(user, "research.edit_all") && data.submittedAt ? { submittedAt: data.submittedAt } : {}),
          authors: { create: authors },
        },
      }),
    ]);
    await audit({ userId: user.id, action: "UPDATE", entity: "ResearchPaper", entityId: id, summary: `تعديل بيانات البحث ${paper.referenceNo}` });
    return ok("تم حفظ التعديلات بنجاح", `/research/${id}`);
  });
}

export async function deletePaperAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const paper = await db.researchPaper.findUnique({ where: { id }, include: { files: { select: { storageKey: true } } } });
    if (!paper) throw new ActionError("البحث غير موجود");
    const ownerDraft = paper.status === "DRAFT" && paper.createdById === user.id;
    if (!can(user, "research.delete") && !ownerDraft) throw new ActionError("ليست لديك صلاحية حذف هذا البحث");
    await db.researchPaper.delete({ where: { id } });
    await Promise.all(paper.files.map((f) => deleteStored(f.storageKey).catch(() => {})));
    await audit({ userId: user.id, action: "DELETE", entity: "ResearchPaper", entityId: id, summary: `حذف البحث ${paper.referenceNo} — ${paper.titleAr}` });
    return ok("تم حذف البحث", "/research");
  });
}

const statusSchema = z.object({
  to: z.enum(ResearchStatus),
  note: z.string().trim().max(4000).optional(),
});

export async function changeStatusAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const { paper, access } = await loadPaperFor(user, id);
    const { to, note } = statusSchema.parse(formToObject(fd));
    const settings = await getSettings();
    const allowed = TRANSITIONS[paper.status].find((t) => t.to === to);
    if (!allowed) throw new ActionError("انتقال غير مسموح من الحالة الحالية");
    const ownerSubmit = access.owner && paper.status === "DRAFT" && to === "SUBMITTED" && settings.allowResearcherSelfSubmit;
    if (!can(user, allowed.perm) && !ownerSubmit) throw new ActionError("ليست لديك صلاحية تنفيذ هذا الانتقال");
    if (to === "SUBMITTED") {
      const hasFile = await db.researchFile.count({ where: { paperId: id, isCurrent: true } });
      if (!hasFile) throw new ActionError("يجب رفع ملف البحث قبل التقديم");
    }
    if (to === "NEEDS_REVISION" && !note) throw new ActionError("يرجى كتابة التعديلات المطلوبة في حقل الملاحظات");
    await applyStatusChange(paper, to, user, note);
    return ok("تم تحديث حالة البحث");
  });
}

/** إرسال نسخة معدلة من الباحث (أو تسجيلها من الموظف) */
export async function submitRevisionAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const { paper, access } = await loadPaperFor(user, id);
    if (paper.status !== "NEEDS_REVISION") throw new ActionError("البحث ليس في حالة طلب تعديلات");
    if (!access.owner && !can(user, "files.manage")) throw new ActionError("ليست لديك صلاحية إرسال نسخة معدلة");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("يرجى إرفاق ملف النسخة المعدلة");
    const note = z.string().trim().max(4000).parse(fd.get("note") ?? "");
    const last = await db.researchVersion.findFirst({ where: { paperId: id }, orderBy: { versionNo: "desc" } });
    const version = await db.researchVersion.create({
      data: { paperId: id, versionNo: (last?.versionNo ?? 0) + 1, note: note || "نسخة معدلة", createdById: user.id },
    });
    const currentMain = await db.researchFile.findFirst({
      where: { paperId: id, isCurrent: true, category: { in: ["MAIN_DOCUMENT", "REVISED_DOCUMENT"] } },
      orderBy: { uploadedAt: "desc" },
    });
    await attachFile({ paperId: id, file, category: "REVISED_DOCUMENT", title: `النسخة المعدلة رقم ${version.versionNo}`, user, versionId: version.id, replacesId: currentMain?.id });
    if (note) await db.researchComment.create({ data: { paperId: id, authorId: user.id, type: "RESEARCHER_REPLY", body: note } });
    await applyStatusChange(paper, "RESUBMITTED", user, note || "إرسال النسخة المعدلة");
    return ok("تم إرسال النسخة المعدلة بنجاح");
  });
}

export async function uploadFileAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const { access } = await loadPaperFor(user, id);
    if (!access.canUpload) throw new ActionError("لا يمكنك رفع ملفات لهذا البحث في حالته الحالية");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("يرجى اختيار ملف");
    const category = z.enum(FileCategory).catch("ATTACHMENT").parse(fd.get("category"));
    const title = z.string().trim().max(200).catch("").parse(fd.get("title") ?? "");
    const replacesId = (fd.get("replacesId") as string) || null;
    await attachFile({ paperId: id, file, category, title, user, replacesId });
    return ok(replacesId ? "تم استبدال الملف مع الاحتفاظ بالنسخة السابقة" : "تم رفع الملف بنجاح");
  });
}

export async function deleteFileAction(fileId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "files.manage")) throw new ActionError("ليست لديك صلاحية حذف الملفات");
    const f = await db.researchFile.findUnique({ where: { id: fileId }, include: { replaces: true } });
    if (!f) throw new ActionError("الملف غير موجود");
    await db.$transaction([
      db.researchFile.delete({ where: { id: fileId } }),
      ...(f.isCurrent && f.replaces ? [db.researchFile.update({ where: { id: f.replaces.id }, data: { isCurrent: true } })] : []),
    ]);
    await deleteStored(f.storageKey).catch(() => {});
    await audit({ userId: user.id, action: "DELETE", entity: "ResearchFile", entityId: fileId, summary: `حذف الملف ${f.originalName}` });
    return ok("تم حذف الملف");
  });
}

export async function addCommentAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const { paper, access } = await loadPaperFor(user, id);
    const body = z.string().trim().min(2, "اكتب نص الملاحظة").max(4000).parse(fd.get("body"));
    let type = z.enum(CommentType).catch("NOTE").parse(fd.get("type"));
    if (!can(user, "research.comment")) {
      if (!access.owner) throw new ActionError("ليست لديك صلاحية إضافة ملاحظات");
      type = "RESEARCHER_REPLY";
    }
    await db.researchComment.create({ data: { paperId: id, authorId: user.id, type, body } });
    await audit({ userId: user.id, action: "CREATE", entity: "ResearchComment", entityId: id, summary: `إضافة ملاحظة على البحث ${paper.referenceNo}` });
    const link = `/research/${id}`;
    if (type === "RESEARCHER_REPLY") {
      await notify(await usersWithPermission("research.comment"), { type: "COMMENT_ADDED", title: "رد جديد من الباحث", body: `${paper.referenceNo}: ${body.slice(0, 140)}`, link }, user.id);
    } else if (type !== "INTERNAL") {
      await notify(await paperOwnerUserIds(id), {
        type: type === "REVISION_REQUEST" ? "REVISION_REQUESTED" : "COMMENT_ADDED",
        title: type === "REVISION_REQUEST" ? "طلب تعديل جديد على بحثك" : "ملاحظة جديدة على بحثك",
        body: `${paper.referenceNo}: ${body.slice(0, 140)}`,
        link,
      }, user.id);
    }
    return ok("تمت إضافة الملاحظة");
  });
}

export async function toggleCommentResolvedAction(commentId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "research.comment")) throw new ActionError("ليست لديك صلاحية");
    const c = await db.researchComment.findUnique({ where: { id: commentId } });
    if (!c) throw new ActionError("الملاحظة غير موجودة");
    await db.researchComment.update({ where: { id: commentId }, data: { isResolved: !c.isResolved } });
    return ok(c.isResolved ? "تم إعادة فتح الملاحظة" : "تم تعليم الملاحظة كمنجزة");
  });
}

const assignSchema = z.object({
  reviewerId: z.string().min(1, "اختر المحكم"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "حدد موعد التسليم"),
  instructions: z.string().trim().max(2000).optional(),
});

export async function assignReviewerAction(paperId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "reviews.assign")) throw new ActionError("ليست لديك صلاحية تعيين المحكمين");
    const data = assignSchema.parse(formToObject(fd));
    const paper = await db.researchPaper.findUnique({ where: { id: paperId } });
    if (!paper) throw new ActionError("البحث غير موجود");
    if (["DRAFT", "ACCEPTED", "REJECTED", "PUBLISHED", "ARCHIVED"].includes(paper.status))
      throw new ActionError("لا يمكن تعيين محكمين لبحث في هذه الحالة");
    const reviewer = await db.user.findFirst({ where: { id: data.reviewerId, isActive: true, role: { permissions: { some: { permission: { code: "reviews.perform" } } } } } });
    if (!reviewer) throw new ActionError("المستخدم المختار ليس محكماً نشطاً");
    const due = new Date(data.dueDate + "T23:59:00");
    if (due < new Date()) throw new ActionError("موعد التسليم يجب أن يكون في المستقبل");
    const round = (await db.researchVersion.count({ where: { paperId } })) || 1;
    const existing = await db.reviewAssignment.findUnique({ where: { paperId_reviewerId_round: { paperId, reviewerId: reviewer.id, round } } });
    if (existing && !["CANCELLED", "DECLINED"].includes(existing.status)) throw new ActionError("هذا المحكم معيّن مسبقاً لهذه الجولة");
    const a = existing
      ? await db.reviewAssignment.update({ where: { id: existing.id }, data: { status: "PENDING", dueDate: due, assignedAt: new Date(), assignedById: user.id, instructions: data.instructions || null, reminderSentAt: null } })
      : await db.reviewAssignment.create({ data: { paperId, reviewerId: reviewer.id, assignedById: user.id, round, dueDate: due, instructions: data.instructions || null } });
    await audit({ userId: user.id, action: "ASSIGN_REVIEWER", entity: "ReviewAssignment", entityId: a.id, summary: `تعيين ${reviewer.name} محكماً للبحث ${paper.referenceNo}` });
    await notify([reviewer.id], { type: "REVIEWER_ASSIGNED", title: "تم تكليفك بتحكيم بحث جديد", body: `${paper.referenceNo}: ${paper.titleAr}`, link: `/reviews/${a.id}` });
    if (["SUBMITTED", "ADMIN_REVIEW", "RESUBMITTED"].includes(paper.status)) {
      await applyStatusChange(paper, "UNDER_REVIEW", user, "إحالة البحث للتحكيم العلمي");
    }
    return ok(`تم تعيين ${reviewer.name} محكماً للبحث`);
  });
}

export async function cancelAssignmentAction(assignmentId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "reviews.assign")) throw new ActionError("ليست لديك صلاحية");
    const a = await db.reviewAssignment.findUnique({ where: { id: assignmentId }, include: { paper: true } });
    if (!a) throw new ActionError("التكليف غير موجود");
    if (a.status === "SUBMITTED") throw new ActionError("لا يمكن إلغاء تكليف تم تسليم تقييمه");
    await db.reviewAssignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });
    await audit({ userId: user.id, action: "UPDATE", entity: "ReviewAssignment", entityId: assignmentId, summary: `إلغاء تكليف تحكيم للبحث ${a.paper.referenceNo}` });
    await notify([a.reviewerId], { type: "SYSTEM", title: "تم إلغاء تكليف تحكيم", body: `${a.paper.referenceNo}: ${a.paper.titleAr}` });
    return ok("تم إلغاء التكليف");
  });
}

export async function extendDeadlineAction(assignmentId: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    if (!can(user, "reviews.assign")) throw new ActionError("ليست لديك صلاحية");
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح").parse(fd.get("dueDate"));
    const a = await db.reviewAssignment.update({ where: { id: assignmentId }, data: { dueDate: new Date(date + "T23:59:00"), reminderSentAt: null }, include: { paper: true } });
    await notify([a.reviewerId], { type: "DEADLINE", title: "تم تعديل موعد تسليم التحكيم", body: `${a.paper.referenceNo}: الموعد الجديد ${date}`, link: `/reviews/${a.id}` });
    await audit({ userId: user.id, action: "UPDATE", entity: "ReviewAssignment", entityId: a.id, summary: `تعديل موعد التحكيم إلى ${date}` });
    return ok("تم تعديل موعد التسليم");
  });
}
