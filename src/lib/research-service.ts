import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify, paperOwnerUserIds, usersWithPermission } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { STATUS_LABELS } from "@/lib/constants";
import type { CurrentUser } from "@/lib/auth";
import type { ResearchStatus } from "@/generated/prisma/enums";
import type { FileCategory } from "@/generated/prisma/enums";
import { storeBuffer, validateUpload } from "@/lib/storage";

export async function generateReferenceNo() {
  const { referencePrefix } = await getSettings();
  const year = new Date().getFullYear();
  const prefix = `${referencePrefix}-${year}-`;
  const last = await db.researchPaper.findFirst({
    where: { referenceNo: { startsWith: prefix } },
    orderBy: { referenceNo: "desc" },
    select: { referenceNo: true },
  });
  const seq = last ? parseInt(last.referenceNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** تطبيق تغيير الحالة مع الآثار الجانبية: التواريخ، السجل، الإشعارات، سجل العمليات */
export async function applyStatusChange(
  paper: { id: string; status: ResearchStatus; referenceNo: string; titleAr: string },
  to: ResearchStatus,
  user: CurrentUser,
  note?: string | null,
) {
  const now = new Date();
  const data: Record<string, unknown> = { status: to };
  if (to === "SUBMITTED") data.submittedAt = now;
  if (to === "ACCEPTED") Object.assign(data, { decidedAt: now, decisionAccepted: true });
  if (to === "REJECTED") Object.assign(data, { decidedAt: now, decisionAccepted: false });
  if (to === "PUBLISHED") Object.assign(data, { publishedAt: now, ...(note ? { publicationInfo: note } : {}) });
  if (to === "ARCHIVED") data.archivedAt = now;

  await db.$transaction([
    db.researchPaper.update({
      where: { id: paper.id },
      data: to === "SUBMITTED" ? { ...data, submittedAt: undefined, status: to } : data,
    }),
    ...(to === "SUBMITTED"
      ? [db.researchPaper.updateMany({ where: { id: paper.id, submittedAt: null }, data: { submittedAt: now } })]
      : []),
    db.researchStatusHistory.create({
      data: { paperId: paper.id, fromStatus: paper.status, toStatus: to, note: note || null, changedById: user.id },
    }),
    ...(note && ["NEEDS_REVISION", "ACCEPTED", "REJECTED"].includes(to)
      ? [
          db.researchComment.create({
            data: { paperId: paper.id, authorId: user.id, type: to === "NEEDS_REVISION" ? "REVISION_REQUEST" : "DECISION", body: note },
          }),
        ]
      : []),
  ]);

  await audit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entity: "ResearchPaper",
    entityId: paper.id,
    summary: `${paper.referenceNo}: ${STATUS_LABELS[paper.status]} ← ${STATUS_LABELS[to]}`,
    details: { from: paper.status, to, note },
  });

  const link = `/research/${paper.id}`;
  const owners = await paperOwnerUserIds(paper.id);
  const body = `${paper.referenceNo}: ${paper.titleAr}`;
  if (to === "SUBMITTED" || to === "RESUBMITTED") {
    const staff = await usersWithPermission("research.change_status");
    await notify(staff, {
      type: "NEW_SUBMISSION",
      title: to === "SUBMITTED" ? "تم تقديم بحث جديد" : "تمت إعادة تقديم بحث بعد التعديل",
      body,
      link,
    }, user.id);
  }
  if (to === "NEEDS_REVISION") {
    await notify(owners, { type: "REVISION_REQUESTED", title: "مطلوب إجراء تعديلات على بحثك", body: note ? `${body}\n${note}` : body, link }, user.id);
  } else if (to === "ACCEPTED" || to === "REJECTED") {
    await notify(owners, { type: "DECISION", title: to === "ACCEPTED" ? "تهانينا! تم قبول بحثك" : "تم رفض البحث", body, link }, user.id);
  } else {
    await notify(owners, { type: "STATUS_CHANGED", title: `تغيرت حالة البحث إلى: ${STATUS_LABELS[to]}`, body, link }, user.id);
  }
}

/** رفع ملف وربطه بالبحث (مع دعم الاستبدال وسجل الإصدارات) */
export async function attachFile(params: {
  paperId: string;
  file: File;
  category: FileCategory;
  title?: string | null;
  user: CurrentUser;
  versionId?: string | null;
  replacesId?: string | null;
  assignmentId?: string | null;
}) {
  const settings = await getSettings();
  const v = await validateUpload(params.file, settings.maxUploadMb);
  const stored = await storeBuffer(v.buffer, v.ext);
  let versionId = params.versionId ?? null;
  if (!versionId) {
    const latest = await db.researchVersion.findFirst({ where: { paperId: params.paperId }, orderBy: { versionNo: "desc" } });
    versionId = latest?.id ?? null;
  }
  const created = await db.$transaction(async (tx) => {
    if (params.replacesId) {
      const old = await tx.researchFile.findFirst({ where: { id: params.replacesId, paperId: params.paperId, isCurrent: true } });
      if (!old) throw new Error("الملف المراد استبداله غير موجود");
      await tx.researchFile.update({ where: { id: old.id }, data: { isCurrent: false } });
    }
    return tx.researchFile.create({
      data: {
        paperId: params.paperId,
        versionId,
        category: params.category,
        title: params.title || null,
        originalName: v.originalName,
        storageKey: stored.storageKey,
        mimeType: v.mime,
        extension: v.ext,
        size: v.buffer.length,
        sha256: stored.sha256,
        uploadedById: params.user.id,
        replacesId: params.replacesId || null,
        assignmentId: params.assignmentId || null,
      },
    });
  });
  await audit({
    userId: params.user.id,
    action: "UPLOAD",
    entity: "ResearchFile",
    entityId: created.id,
    summary: `رفع الملف ${v.originalName}${params.replacesId ? " (استبدال نسخة سابقة)" : ""}`,
    details: { paperId: params.paperId, size: v.buffer.length },
  });
  return created;
}
