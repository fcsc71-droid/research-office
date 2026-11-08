import { getCurrentUser, can } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { buildReport, parseReportFilters } from "@/lib/reports";
import { reportToXlsx } from "@/lib/excel";
import { buildDocumentHtml, htmlToPdf, PdfUnavailableError } from "@/lib/pdf";
import { audit } from "@/lib/audit";
import { fileResponse, jsonError } from "@/lib/http";
import { esc } from "@/lib/utils";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  if (!can(user, "reports.view")) return jsonError("ليست لديك صلاحية", 403);
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "pdf";
  const filters = parseReportFilters(Object.fromEntries(url.searchParams));
  const report = await buildReport(filters);
  const settings = await getSettings();
  const stamp = new Date().toISOString().slice(0, 10);
  await audit({ userId: user.id, action: "EXPORT", entity: "Report", entityId: filters.type, summary: `تصدير ${report.title} (${format.toUpperCase()})` });

  if (format === "xlsx") {
    const buf = await reportToXlsx(report, settings.watermarkInExports);
    return fileResponse(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `report-${filters.type}-${stamp}.xlsx`);
  }

  const bodyHtml = `
    <div class="stats">${report.summary.map((s) => `<div class="stat"><b>${esc(s.value)}</b><small>${esc(s.label)}</small></div>`).join("")}</div>
    ${report.rows.length
      ? `<table><thead><tr>${report.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
         <tbody>${report.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : `<p class="muted">لا توجد بيانات ضمن المعايير المحددة.</p>`}`;
  const opts = {
    title: report.title,
    subtitle: report.subtitle,
    orgName: `${settings.universityName} — ${settings.officeName}`,
    bodyHtml,
    watermark: settings.watermarkInExports,
    landscape: report.columns.length > 6,
  };
  if (format === "pdf") {
    try {
      const pdf = await htmlToPdf(await buildDocumentHtml(opts), opts.landscape);
      return fileResponse(pdf, "application/pdf", `report-${filters.type}-${stamp}.pdf`);
    } catch (e) {
      if (!(e instanceof PdfUnavailableError)) console.error(e);
    }
  }
  return new Response(await buildDocumentHtml(opts, true), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
