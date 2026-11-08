import { db } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { getPaperAccess } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { buildDocumentHtml, htmlToPdf, PdfUnavailableError } from "@/lib/pdf";
import { audit } from "@/lib/audit";
import { fileResponse, jsonError } from "@/lib/http";
import { FILE_CATEGORY_LABELS, LEVEL_LABELS, RECOMMENDATION_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/constants";
import { esc, formatBytes, formatDate, formatDateTime } from "@/lib/utils";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  const { id } = await ctx.params;
  const paper = await db.researchPaper.findUnique({
    where: { id },
    include: {
      college: true, department: true, category: true,
      authors: { orderBy: { order: "asc" } },
      files: { where: { isCurrent: true, category: { not: "REVIEW_REPORT" } }, orderBy: { uploadedAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      assignments: { where: { status: "SUBMITTED" }, include: { review: true } },
    },
  });
  if (!paper) return jsonError("البحث غير موجود", 404);
  const settings = await getSettings();
  const access = await getPaperAccess(user, paper, settings.blindReview);
  if (!(access.staff || access.owner || access.archiveReader)) return jsonError("ليست لديك صلاحية", 403);

  const row = (k: string, v: unknown) => `<tr><th>${esc(k)}</th><td>${esc(v ?? "—") || "—"}</td></tr>`;
  let body = `
  <h2>البيانات الأساسية</h2>
  <table class="kv">
    ${row("الرقم المرجعي", paper.referenceNo)}
    ${row("عنوان البحث بالعربية", paper.titleAr)}
    ${paper.titleEn ? `<tr><th>عنوان البحث بالإنجليزية</th><td class="ltr">${esc(paper.titleEn)}</td></tr>` : ""}
    ${row("الحالة", STATUS_LABELS[paper.status])}
    ${row("نوع البحث", TYPE_LABELS[paper.type])}
    ${row("مستوى البحث", LEVEL_LABELS[paper.level])}
    ${row("الكلية", paper.college?.name)}
    ${row("القسم العلمي", paper.department?.name)}
    ${row("التخصص", [paper.category?.name, paper.specialization].filter(Boolean).join(" — "))}
    ${row("المشرف", paper.supervisorName)}
    ${row("تاريخ التقديم", formatDate(paper.submittedAt))}
    ${paper.decidedAt ? row("تاريخ القرار", formatDate(paper.decidedAt)) : ""}
    ${paper.publishedAt ? row("تاريخ النشر", formatDate(paper.publishedAt)) : ""}
    ${paper.publicationInfo ? row("بيانات النشر", paper.publicationInfo) : ""}
    ${row("الكلمات المفتاحية", paper.keywords.join("، "))}
  </table>
  <h2>الملخص</h2>
  <div class="box">${esc(paper.abstract).replace(/\n/g, "<br>")}</div>
  <h2>الباحثون</h2>
  <table><tr><th>#</th><th>الاسم</th><th>الصفة</th></tr>
    ${paper.authors.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.name)}</td><td>${a.role === "MAIN" ? "الباحث الرئيسي" : "باحث مشارك"}</td></tr>`).join("")}
  </table>
  <h2>الملفات المرفقة</h2>
  ${paper.files.length ? `<table><tr><th>الملف</th><th>التصنيف</th><th>الحجم</th><th>تاريخ الرفع</th></tr>
    ${paper.files.map((f) => `<tr><td>${esc(f.title || f.originalName)}<br><small class="muted ltr">${esc(f.originalName)}</small></td><td>${FILE_CATEGORY_LABELS[f.category]}</td><td>${formatBytes(f.size)}</td><td>${formatDateTime(f.uploadedAt)}</td></tr>`).join("")}
  </table>` : `<p class="muted">لا توجد ملفات</p>`}`;

  if ((access.staff || access.owner) && paper.statusHistory.length) {
    body += `<h2>سجل مراحل البحث</h2><table><tr><th>التاريخ</th><th>الحالة</th><th>بواسطة</th><th>ملاحظات</th></tr>
      ${paper.statusHistory.map((h) => `<tr><td>${formatDateTime(h.createdAt)}</td><td>${STATUS_LABELS[h.toStatus]}</td><td>${esc(h.changedBy.name)}</td><td>${esc(h.note ?? "")}</td></tr>`).join("")}</table>`;
  }
  if (can(user, "reviews.view_all") && paper.assignments.length) {
    body += `<h2>ملخص نتائج التحكيم (سري)</h2><table><tr><th>المحكم</th><th>الجولة</th><th>الدرجة /10</th><th>التوصية</th></tr>
      ${paper.assignments.filter((a) => a.review).map((a, i) => `<tr><td>محكم ${i + 1}</td><td>${a.round}</td><td>${a.review!.overallScore.toFixed(1)}</td><td>${RECOMMENDATION_LABELS[a.review!.recommendation]}</td></tr>`).join("")}</table>`;
  }

  const opts = {
    title: "بطاقة بيانات بحث علمي",
    subtitle: `${paper.referenceNo} — ${paper.titleAr}`,
    orgName: `${settings.universityName} — ${settings.officeName}`,
    bodyHtml: body,
    watermark: settings.watermarkInExports,
  };
  await audit({ userId: user.id, action: "EXPORT", entity: "ResearchPaper", entityId: paper.id, summary: `تصدير بطاقة البحث ${paper.referenceNo}` });

  const print = new URL(req.url).searchParams.get("print") === "1";
  if (!print) {
    try {
      const pdf = await htmlToPdf(await buildDocumentHtml(opts));
      return fileResponse(pdf, "application/pdf", `${paper.referenceNo}.pdf`);
    } catch (e) {
      if (!(e instanceof PdfUnavailableError)) console.error(e);
      // عند عدم توفر محرك PDF نعرض نسخة قابلة للطباعة/الحفظ كـ PDF من المتصفح
    }
  }
  return new Response(await buildDocumentHtml(opts, true), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
