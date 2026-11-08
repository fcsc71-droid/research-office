/**
 * يولّد ملف assets/watermark-stamp.pdf المستخدم لختم ملفات PDF المرفوعة بالعلامة المائية.
 * يتطلب Chromium (متغير CHROMIUM_PATH أو متصفح Playwright المثبت).
 */
import "dotenv/config";
import path from "node:path";
import { promises as fs } from "node:fs";
import { chromium } from "playwright-core";

const TEXT = "عمل الطالبة رهف إبراهيم والطالبة أسيل خالد";

async function main() {
  const dir = path.join(process.cwd(), "node_modules/@fontsource/cairo/files");
  const font = (await fs.readFile(path.join(dir, "cairo-arabic-700-normal.woff2"))).toString("base64");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
    @font-face{font-family:Cairo;font-weight:700;src:url(data:font/woff2;base64,${font}) format('woff2')}
    html,body{margin:0;background:transparent}
    .s{width:1500px;height:130px;display:flex;align-items:center;justify-content:center;font-family:Cairo;font-weight:700;font-size:56px;color:rgba(30,58,138,0.13);white-space:nowrap}
  </style></head><body><div class="s">${TEXT}</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ width: "1500px", height: "130px", printBackground: false, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
  await browser.close();
  const out = path.join(process.cwd(), "assets", "watermark-stamp.pdf");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, pdf);
  console.log("✔", out);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
