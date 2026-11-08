import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { PDFDocument, degrees } from "pdf-lib";
import { WATERMARK_TEXT, APP_NAME } from "@/lib/constants";
import { esc } from "@/lib/utils";

// ───────────── الخطوط (مضمنة base64 لضمان عرض العربية في PDF) ─────────────
let fontCss: string | null = null;
async function getFontCss() {
  if (fontCss) return fontCss;
  const dir = path.join(process.cwd(), "node_modules/@fontsource/cairo/files");
  const faces: string[] = [];
  for (const subset of ["arabic", "latin"]) {
    for (const weight of [400, 700]) {
      try {
        const buf = await fs.readFile(path.join(dir, `cairo-${subset}-${weight}-normal.woff2`));
        faces.push(
          `@font-face{font-family:'Cairo';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');${
            subset === "latin" ? "unicode-range:U+0000-00FF,U+2000-206F;" : ""
          }}`,
        );
      } catch {
        /* الخط غير متوفر — سيستخدم المتصفح خطاً بديلاً */
      }
    }
  }
  fontCss = faces.join("\n");
  return fontCss;
}

// ───────────── قالب المستندات المصدرة ─────────────
export type DocOptions = {
  title: string;
  subtitle?: string;
  orgName?: string;
  bodyHtml: string;
  watermark: boolean;
  landscape?: boolean;
};

export const DOC_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#0f1f35;font-size:11.5px;line-height:1.75;direction:rtl;background:#fff}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.wm span{transform:rotate(-35deg);font-size:46px;font-weight:700;color:#1e3a8a;opacity:.085;white-space:nowrap}
.content{position:relative;z-index:1}
header.doc{border-bottom:3px solid #0f2a4a;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
header.doc .org{font-size:12px;color:#3b5b85;font-weight:700}
header.doc h1{margin:2px 0 0;font-size:20px;color:#0f2a4a}
header.doc .sub{color:#4b6280;font-size:11px}
header.doc .meta{font-size:10px;color:#6b7c93;text-align:left;white-space:nowrap}
h2{font-size:14px;color:#0f2a4a;border-right:4px solid #3b82c4;padding-right:8px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;margin:6px 0 12px;background:transparent}
th,td{border:1px solid #c9d6e6;padding:5px 7px;text-align:right;vertical-align:top}
th{background:rgba(15,42,74,.92);color:#fff;font-weight:700;font-size:11px}
tr:nth-child(even) td{background:rgba(234,241,250,.55)}
table.kv th{width:28%;background:rgba(234,241,250,.9);color:#0f2a4a}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px}
.stat{flex:1 1 120px;border:1px solid #c9d6e6;border-radius:8px;padding:8px 10px;background:rgba(246,249,253,.8)}
.stat b{display:block;font-size:18px;color:#0f2a4a}
.stat small{color:#4b6280}
.muted{color:#6b7c93}
.box{border:1px solid #c9d6e6;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:rgba(255,255,255,.6)}
.ltr{direction:ltr;text-align:left}
footer.doc{margin-top:22px;border-top:1px solid #c9d6e6;padding-top:6px;font-size:9.5px;color:#6b7c93;display:flex;justify-content:space-between}
@page{margin:14mm 12mm}
`;

export function watermarkHtml() {
  return `<div class="wm" aria-hidden="true"><span>${esc(WATERMARK_TEXT)}</span></div>`;
}

export async function buildDocumentHtml(opts: DocOptions, forPrint = false) {
  const now = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>${await getFontCss()}${DOC_CSS}${forPrint ? ".noprint{position:fixed;top:10px;left:10px;z-index:5}@media print{.noprint{display:none}}" : ""}</style></head>
<body>${opts.watermark ? watermarkHtml() : ""}
${forPrint ? `<div class="noprint"><button onclick="window.print()" style="font-family:Cairo;padding:6px 14px;border-radius:6px;border:1px solid #0f2a4a;background:#0f2a4a;color:#fff;cursor:pointer">طباعة</button></div>` : ""}
<div class="content">
<header class="doc"><div><div class="org">${esc(opts.orgName ?? APP_NAME)}</div><h1>${esc(opts.title)}</h1>${
    opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ""
  }</div><div class="meta">تاريخ الإصدار<br>${esc(now)}</div></header>
${opts.bodyHtml}
<footer class="doc"><span>${esc(APP_NAME)}</span><span>مستند صادر آلياً من النظام</span></footer>
</div>${forPrint ? "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script>" : ""}</body></html>`;
}

// ───────────── التحويل إلى PDF باستخدام Chromium ─────────────
type Browser = import("playwright-core").Browser;
let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright-core");
      return chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
    })();
    browserPromise.catch(() => (browserPromise = null));
  }
  const b = await browserPromise;
  if (!b.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return b;
}

export class PdfUnavailableError extends Error {}

export async function htmlToPdf(html: string, landscape = false): Promise<Buffer> {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    console.error("Chromium launch failed", e);
    throw new PdfUnavailableError("محرك PDF غير متوفر على الخادم");
  }
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      landscape,
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** ينشئ PDF للمستند، وعند تعذر Chromium يعيد null ليتم استخدام صفحة الطباعة */
export async function renderDocumentPdf(opts: DocOptions) {
  const html = await buildDocumentHtml(opts);
  return htmlToPdf(html, opts.landscape);
}

// ───────────── ختم ملفات PDF المرفوعة بالعلامة المائية ─────────────
const STAMP_PATH = path.join(process.cwd(), "assets", "watermark-stamp.pdf");
let stampBytes: Buffer | null = null;

async function getStamp() {
  if (stampBytes) return stampBytes;
  try {
    stampBytes = await fs.readFile(STAMP_PATH);
  } catch {
    // توليد الختم عند عدم وجوده (يتطلب Chromium)
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${await getFontCss()}
      html,body{margin:0;background:transparent}
      .s{width:1500px;height:130px;display:flex;align-items:center;justify-content:center;font-family:Cairo;font-weight:700;font-size:56px;color:rgba(30,58,138,0.13);white-space:nowrap}
    </style></head><body><div class="s">${esc(WATERMARK_TEXT)}</div></body></html>`;
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ width: "1500px", height: "130px", printBackground: false, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    await page.close();
    stampBytes = Buffer.from(pdf);
    await fs.mkdir(path.dirname(STAMP_PATH), { recursive: true }).catch(() => {});
    await fs.writeFile(STAMP_PATH, stampBytes).catch(() => {});
  }
  return stampBytes;
}

export async function stampPdfWatermark(input: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(input, { ignoreEncryption: true });
  const [stamp] = await doc.embedPdf(await getStamp());
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const diag = Math.sqrt(width * width + height * height);
    const w = diag * 0.8;
    const h = (w * stamp.height) / stamp.width;
    const angle = Math.atan2(height, width); // قطري من أسفل اليسار لأعلى اليمين
    const cx = width / 2;
    const cy = height / 2;
    // حساب نقطة البداية بحيث يكون مركز الختم في منتصف الصفحة
    const x = cx - (w / 2) * Math.cos(angle) + (h / 2) * Math.sin(angle);
    const y = cy - (w / 2) * Math.sin(angle) - (h / 2) * Math.cos(angle);
    page.drawPage(stamp, { x, y, width: w, height: h, rotate: degrees((angle * 180) / Math.PI) }); // الشفافية مضمّنة في الختم نفسه
  }
  return Buffer.from(await doc.save());
}
