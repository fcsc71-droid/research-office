"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, usersWithPermission } from "@/lib/notify";
import { attachFile } from "@/lib/research-service";
import { ActionError, formToObject, ok, run, type ActionResult } from "@/lib/action";
import { ReviewRecommendation } from "@/generated/prisma/enums";
import { RECOMMENDATION_LABELS } from "@/lib/constants";

const score = z.coerce.number({ error: "أدخل درجة" }).int().min(1, "الدرجة من 1 إلى 10").max(10, "الدرجة من 1 إلى 10");

const reviewSchema = z.object({
  qualityScore: score,
  methodologyScore: score,
  referencesScore: score,
  resultsScore: score,
  originalityScore: score,
  recommendation: z.enum(ReviewRecommendation, { error: "اختر التوصية" }),
  commentsToAuthor: z.string().trim().min(10, "اكتب ملاحظاتك للباحث (10 أحرف على الأقل)").max(10000),
  confidentialComments: z.string().trim().max(5000).optional(),
  intent: z.enum(["draft", "submit"]).default("draft"),
});

async function loadOwnAssignment(id: string) {
  const user = await assertUser();
  if (!can(user, "reviews.perform")) throw new ActionError("ليست لديك صلاحية التحكيم");
  const a = await db.reviewAssignment.findUnique({ where: { id }, include: { paper: true, review: true } });
  // المحكم يصل فقط إلى التكليفات المسندة إليه
  if (!a || a.reviewerId !== user.id) throw new ActionError("التكليف غير موجود");
  return { user, a };
}

export async function saveReviewAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, a } = await loadOwnAssignment(id);
    if (!["PENDING", "IN_PROGRESS"].includes(a.status)) throw new ActionError("لا يمكن تعديل التقييم بعد تسليمه أو إلغاء التكليف");
    const raw = formToObject(fd);
    const data = reviewSchema.parse(raw);
    const scores = [data.qualityScore, data.methodologyScore, data.referencesScore, data.resultsScore, data.originalityScore];
    const overallScore = Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10;
    const submit = data.intent === "submit";
    const payload = {
      qualityScore: data.qualityScore,
      methodologyScore: data.methodologyScore,
      referencesScore: data.referencesScore,
      resultsScore: data.resultsScore,
      originalityScore: data.originalityScore,
      overallScore,
      recommendation: data.recommendation,
      commentsToAuthor: data.commentsToAuthor,
      confidentialComments: data.confidentialComments || null,
      isDraft: !submit,
      submittedAt: submit ? new Date() : null,
    };
    await db.$transaction([
      db.researchReview.upsert({ where: { assignmentId: id }, create: { assignmentId: id, ...payload }, update: payload }),
      db.reviewAssignment.update({ where: { id }, data: { status: submit ? "SUBMITTED" : "IN_PROGRESS", completedAt: submit ? new Date() : null } }),
    ]);
    const file = fd.get("reportFile");
    if (file instanceof File && file.size > 0) {
      await attachFile({ paperId: a.paperId, file, category: "REVIEW_REPORT", title: "تقرير المحكم", user, assignmentId: id });
    }
    if (submit) {
      await audit({ userId: user.id, action: "SUBMIT_REVIEW", entity: "ReviewAssignment", entityId: id, summary: `تسليم تقييم البحث ${a.paper.referenceNo} — ${RECOMMENDATION_LABELS[data.recommendation]}` });
      await notify(await usersWithPermission("reviews.view_all"), {
        type: "REVIEW_SUBMITTED",
        title: "تم تسليم تقييم تحكيم",
        body: `${a.paper.referenceNo}: ${a.paper.titleAr} — التوصية: ${RECOMMENDATION_LABELS[data.recommendation]}`,
        link: `/research/${a.paperId}`,
      }, user.id);
      return ok("تم تسليم التقييم بنجاح. شكراً لك", "/reviews");
    }
    return ok("تم حفظ المسودة");
  });
}

export async function declineAssignmentAction(id: string, _: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, a } = await loadOwnAssignment(id);
    if (!["PENDING", "IN_PROGRESS"].includes(a.status)) throw new ActionError("لا يمكن الاعتذار عن هذا التكليف");
    const reason = z.string().trim().min(3, "اذكر سبب الاعتذار").max(1000).parse(fd.get("reason"));
    await db.reviewAssignment.update({ where: { id }, data: { status: "DECLINED", instructions: `${a.instructions ?? ""}\n— سبب الاعتذار: ${reason}`.trim() } });
    await audit({ userId: user.id, action: "UPDATE", entity: "ReviewAssignment", entityId: id, summary: `اعتذار عن تحكيم البحث ${a.paper.referenceNo}` });
    await notify(await usersWithPermission("reviews.assign"), {
      type: "SYSTEM",
      title: "اعتذار محكم عن التحكيم",
      body: `${user.name} — ${a.paper.referenceNo}: ${reason}`,
      link: `/research/${a.paperId}`,
    });
    return ok("تم تسجيل الاعتذار", "/reviews");
  });
}
