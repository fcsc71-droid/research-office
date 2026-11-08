import "server-only";
import ExcelJS from "exceljs";
import { WATERMARK_TEXT, APP_NAME } from "@/lib/constants";
import type { ReportData } from "@/lib/reports";

/** تصدير تقرير إلى Excel (اتجاه من اليمين لليسار + العلامة المائية في الترويسة والتذييل) */
export async function reportToXlsx(report: ReportData, watermark: boolean) {
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();
  const ws = wb.addWorksheet("التقرير", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: watermark ? 5 : 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  if (watermark) {
    ws.headerFooter.oddHeader = `&C&10&K1E3A8A${WATERMARK_TEXT}`;
    ws.headerFooter.oddFooter = `&L&8${APP_NAME}&C&9&K1E3A8A${WATERMARK_TEXT}&R&8صفحة &P من &N`;
  }
  const ncol = Math.max(report.columns.length, 2);
  const title = ws.addRow([report.title]);
  ws.mergeCells(1, 1, 1, ncol);
  title.font = { bold: true, size: 15, color: { argb: "FF0F2A4A" } };
  title.alignment = { horizontal: "center" };
  const sub = ws.addRow([`${APP_NAME} — ${report.subtitle}`]);
  ws.mergeCells(2, 1, 2, ncol);
  sub.alignment = { horizontal: "center" };
  sub.font = { color: { argb: "FF4B6280" } };
  const sum = ws.addRow([report.summary.map((s) => `${s.label}: ${s.value}`).join("   |   ")]);
  ws.mergeCells(3, 1, 3, ncol);
  sum.alignment = { horizontal: "center" };
  if (watermark) {
    const wm = ws.addRow([WATERMARK_TEXT]);
    ws.mergeCells(4, 1, 4, ncol);
    wm.font = { italic: true, color: { argb: "FF8AA4C8" } };
    wm.alignment = { horizontal: "center" };
  }
  const header = ws.addRow(report.columns);
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2A4A" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  for (const r of report.rows) {
    const row = ws.addRow(r);
    row.alignment = { vertical: "top", wrapText: true, horizontal: "right" };
  }
  report.columns.forEach((col, i) => {
    const maxLen = Math.max(col.length, ...report.rows.map((r) => String(r[i] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 12), 60);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
