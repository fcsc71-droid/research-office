import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { ALLOWED_EXTENSIONS } from "@/lib/constants";

export const STORAGE_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || "./storage");
const UPLOAD_ROOT = path.join(STORAGE_ROOT, "uploads");

/** الامتداد المتوقع من فحص محتوى الملف الحقيقي (magic bytes) */
const DETECTED_FOR_EXT: Record<string, string[]> = {
  pdf: ["pdf"],
  docx: ["docx"],
  doc: ["cfb"],
  xlsx: ["xlsx"],
  pptx: ["pptx"],
  png: ["png"],
  jpg: ["jpg"],
  jpeg: ["jpg"],
  webp: ["webp"],
  gif: ["gif"],
};

export class UploadError extends Error {}

export async function validateUpload(file: File, maxMb: number) {
  if (!file || typeof file === "string" || file.size === 0) throw new UploadError("لم يتم اختيار ملف");
  if (file.size > maxMb * 1024 * 1024) throw new UploadError(`حجم الملف يتجاوز الحد المسموح (${maxMb} م.ب)`);
  const name = path.basename(file.name).slice(0, 200);
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) throw new UploadError("نوع الملف غير مسموح. الأنواع المسموحة: PDF, DOCX, DOC, XLSX, PPTX, الصور");
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !DETECTED_FOR_EXT[ext]?.includes(detected.ext)) {
    throw new UploadError("محتوى الملف لا يطابق امتداده — تم رفض الملف لأسباب أمنية");
  }
  const mime = ext === "doc" ? "application/msword" : detected.mime;
  return { buffer, ext, mime, originalName: name };
}

export async function storeBuffer(buffer: Buffer, ext: string) {
  const now = new Date();
  const rel = path.posix.join(
    "uploads",
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${ext}`,
  );
  const abs = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer, { mode: 0o640 });
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { storageKey: rel, sha256 };
}

function resolveKey(storageKey: string) {
  const abs = path.resolve(/*turbopackIgnore: true*/ STORAGE_ROOT, storageKey);
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) throw new Error("مسار ملف غير صالح");
  return abs;
}

export async function readStored(storageKey: string) {
  return fs.readFile(resolveKey(storageKey));
}

export async function deleteStored(storageKey: string) {
  await fs.rm(resolveKey(storageKey), { force: true });
}
