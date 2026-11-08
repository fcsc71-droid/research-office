import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { STORAGE_ROOT } from "@/lib/storage";

export const BACKUP_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.BACKUP_DIR || path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, "backups"));

/** إنشاء نسخة احتياطية لقاعدة البيانات باستخدام pg_dump (تنسيق custom مضغوط) */
export async function createDatabaseBackup(): Promise<string> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير معرف");
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
  const out = path.join(/*turbopackIgnore: true*/ BACKUP_DIR, name);
  const dbUrl = new URL(url);
  dbUrl.searchParams.delete("schema");
  await new Promise<void>((resolve, reject) => {
    const p = spawn(/*turbopackIgnore: true*/ process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--no-owner", `--file=${out}`, dbUrl.toString()], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`تعذر تشغيل pg_dump: ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `pg_dump exit ${code}`))));
  });
  return name;
}

export async function listBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const items = await Promise.all(
      files.filter((f) => /^backup-[\w-]+\.dump$/.test(f)).map(async (f) => {
        const st = await fs.stat(path.join(/*turbopackIgnore: true*/ BACKUP_DIR, f));
        return { name: f, size: st.size, createdAt: st.mtime };
      }),
    );
    return items.sort((a, b) => +b.createdAt - +a.createdAt);
  } catch {
    return [];
  }
}

export function backupPath(name: string) {
  if (!/^backup-[\w-]+\.dump$/.test(name)) throw new Error("اسم ملف غير صالح");
  return path.join(/*turbopackIgnore: true*/ BACKUP_DIR, name);
}
