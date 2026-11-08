import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

/**
 * ذاكرة العملاء: لكل شخص ملف JSON يحتوي سجل محادثته (نصوص فقط)
 * وملاحظات يستنتجها الوكيل عنه (الاسم، الاهتمام، الحالة...) وحالة الإيقاف المؤقت.
 */

export type Channel = "messenger" | "comment";

export interface StoredTurn {
  role: "user" | "assistant";
  text: string;
  channel: Channel;
  at: string;
}

export interface CustomerRecord {
  id: string; // PSID في ماسنجر أو معرّف المستخدم في التعليقات
  name?: string;
  notes: string[];
  turns: StoredTurn[];
  pausedUntil?: string; // حين يتولى موظف بشري المحادثة
  createdAt: string;
  updatedAt: string;
}

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");
const fileFor = (id: string) => path.join(config.dataDir, "customers", `${safe(id)}.json`);

// قفل بسيط لكل عميل حتى لا تتداخل معالجة رسالتين متتاليتين
const locks = new Map<string, Promise<unknown>>();
export async function withCustomerLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  locks.set(id, run);
  try {
    return await run;
  } finally {
    if (locks.get(id) === run) locks.delete(id);
  }
}

export async function loadCustomer(id: string): Promise<CustomerRecord> {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), "utf8")) as CustomerRecord;
  } catch {
    const now = new Date().toISOString();
    return { id, notes: [], turns: [], createdAt: now, updatedAt: now };
  }
}

export async function saveCustomer(rec: CustomerRecord): Promise<void> {
  rec.updatedAt = new Date().toISOString();
  // نحتفظ بآخر 200 رسالة فقط على القرص
  if (rec.turns.length > 200) rec.turns = rec.turns.slice(-200);
  const file = fileFor(rec.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rec, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export function isPaused(rec: CustomerRecord): boolean {
  return !!rec.pausedUntil && new Date(rec.pausedUntil).getTime() > Date.now();
}

export function pauseFor(rec: CustomerRecord, hours: number) {
  rec.pausedUntil = new Date(Date.now() + hours * 3600_000).toISOString();
}

/** منع معالجة نفس الحدث مرتين (فيسبوك يعيد إرسال الأحداث أحياناً) */
const seen = new Map<string, number>();
export function alreadyProcessed(eventId: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 3600_000) seen.delete(k);
  if (seen.has(eventId)) return true;
  seen.set(eventId, now);
  return false;
}
