import fs from "node:fs";
import path from "node:path";

/** تحميل ملف .env بسيط (بدون مكتبات إضافية) إن وُجد */
function loadDotEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

const env = (name: string, fallback = "") => process.env[name] ?? fallback;

export const config = {
  port: Number(env("PORT", "3000")),

  // ───── فيسبوك / Meta ─────
  pageAccessToken: env("FB_PAGE_ACCESS_TOKEN"),
  appSecret: env("FB_APP_SECRET"),
  appId: env("FB_APP_ID"),
  verifyToken: env("FB_VERIFY_TOKEN"),
  graphVersion: env("FB_GRAPH_VERSION", "v23.0"),

  // ───── سلوك البوت ─────
  replyToComments: env("REPLY_TO_COMMENTS", "true") === "true",
  privateReplyToComments: env("PRIVATE_REPLY_TO_COMMENTS", "false") === "true",
  replyToMessenger: env("REPLY_TO_MESSENGER", "true") === "true",
  /** عدد الساعات التي يتوقف فيها البوت عن الرد بعد تدخّل موظف بشري */
  humanPauseHours: Number(env("HUMAN_PAUSE_HOURS", "12")),
  /** أقصى عدد رسائل سابقة تُرسل للنموذج من كل محادثة */
  historyLimit: Number(env("HISTORY_LIMIT", "40")),
  /** معرّف ماسنجر (PSID) لمسؤول يُبلَّغ عند تحويل المحادثة لموظف (اختياري) */
  adminPsid: env("ADMIN_PSID"),

  // ───── Claude ─────
  model: env("CLAUDE_MODEL", "claude-opus-5-5"),
  effort: env("CLAUDE_EFFORT", "low") as "low" | "medium" | "high",

  // ───── التخزين ─────
  dataDir: path.resolve(env("DATA_DIR", "./data")),
  knowledgeFile: path.resolve(env("KNOWLEDGE_FILE", "./knowledge/center-info.md")),
};

export function assertFacebookConfig() {
  const missing = (
    [
      ["FB_PAGE_ACCESS_TOKEN", config.pageAccessToken],
      ["FB_APP_SECRET", config.appSecret],
      ["FB_VERIFY_TOKEN", config.verifyToken],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`متغيرات بيئة ناقصة: ${missing.join(", ")} (راجع ملف .env.example)`);
  }
}
