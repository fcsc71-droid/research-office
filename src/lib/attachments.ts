import "server-only";
import { db } from "@/lib/db";
import { can, type CurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { storeBuffer, validateUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";

export type EntityType = "RESEARCHER_CV" | "PROJECT" | "EVENT" | "COLLABORATION" | "AWARD";

export async function saveAttachment(entityType: EntityType, entityId: string, file: File, user: CurrentUser, title?: string | null) {
  const settings = await getSettings();
  const v = await validateUpload(file, settings.maxUploadMb);
  const stored = await storeBuffer(v.buffer, v.ext);
  const a = await db.attachment.create({
    data: {
      entityType, entityId, title: title || null, originalName: v.originalName, storageKey: stored.storageKey,
      mimeType: v.mime, extension: v.ext, size: v.buffer.length, uploadedById: user.id,
    },
  });
  await audit({ userId: user.id, action: "UPLOAD", entity: "Attachment", entityId: a.id, summary: `رفع مرفق ${v.originalName}` });
  return a;
}

/** رفع جميع الملفات المرسلة في حقل النموذج (يدعم تعدد الملفات) */
export async function saveFormAttachments(fd: FormData, field: string, entityType: EntityType, entityId: string, user: CurrentUser) {
  const files = fd.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) await saveAttachment(entityType, entityId, f, user);
  return files.length;
}

export async function attachmentsFor(entityType: EntityType, ids: string[]) {
  if (!ids.length) return new Map<string, Awaited<ReturnType<typeof db.attachment.findMany>>>();
  const list = await db.attachment.findMany({ where: { entityType, entityId: { in: ids } }, orderBy: { createdAt: "asc" } });
  const m = new Map<string, typeof list>();
  for (const a of list) m.set(a.entityId, [...(m.get(a.entityId) ?? []), a]);
  return m;
}

/** هل يحق للمستخدم الوصول للمرفق؟ (يُفحص على الخادم لكل تنزيل) */
export async function canAccessAttachment(user: CurrentUser, a: { entityType: string; entityId: string; uploadedById: string }) {
  if (user.roleKey === "ADMIN" || a.uploadedById === user.id) return true;
  switch (a.entityType) {
    case "RESEARCHER_CV": {
      if (can(user, "researchers.view")) return true;
      return user.researcherId === a.entityId;
    }
    case "PROJECT": {
      if (can(user, "projects.manage") || can(user, "records.approve")) return true;
      const p = await db.researchProject.findUnique({ where: { id: a.entityId }, include: { lead: true, members: { include: { researcher: true } } } });
      if (!p) return false;
      if (p.lead.userId === user.id || p.members.some((m) => m.researcher?.userId === user.id)) return true;
      return can(user, "research.view_department") && !!p.departmentId && p.departmentId === user.departmentId;
    }
    case "EVENT": {
      if (can(user, "events.manage") || can(user, "records.approve")) return true;
      const e = await db.scientificEvent.findUnique({ where: { id: a.entityId }, include: { participants: { include: { researcher: true } } } });
      if (!e) return false;
      if (e.organizedByInstitute && e.approval === "APPROVED") return true;
      return e.participants.some((x) => x.researcher.userId === user.id);
    }
    case "COLLABORATION":
      return can(user, "collaborations.manage") || can(user, "departments.profile");
    case "AWARD": {
      if (can(user, "awards.manage") || can(user, "records.approve")) return true;
      const w = await db.award.findUnique({ where: { id: a.entityId }, include: { researcher: true } });
      return w?.researcher.userId === user.id;
    }
  }
  return false;
}
