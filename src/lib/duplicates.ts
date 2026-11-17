import "server-only";
import { db } from "@/lib/db";

/** توحيد النص العربي/الإنجليزي للمقارنة: إزالة التشكيل وتوحيد الهمزات والتاء المربوطة وعلامات الترقيم */
export function normalizeTitle(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDoi(doi: string | null | undefined) {
  return (doi ?? "").trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "") || null;
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = new Set(a.split(" ").filter((w) => w.length > 1));
  const B = new Set(b.split(" ").filter((w) => w.length > 1));
  const inter = [...A].filter((w) => B.has(w)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

/** البحث عن سجلات مكررة محتملة (نفس DOI أو تشابه العنوان ≥ 80%) */
export async function findPaperDuplicates(p: { id?: string; doi?: string | null; titleAr: string; titleEn?: string | null }) {
  const doi = normalizeDoi(p.doi);
  const ar = normalizeTitle(p.titleAr);
  const en = normalizeTitle(p.titleEn);
  const all = await db.researchPaper.findMany({
    where: p.id ? { id: { not: p.id } } : {},
    select: { id: true, referenceNo: true, titleAr: true, titleEn: true, doi: true, status: true },
  });
  return all
    .map((x) => {
      const sameDoi = !!doi && normalizeDoi(x.doi) === doi;
      const score = Math.max(similarity(ar, normalizeTitle(x.titleAr)), en ? similarity(en, normalizeTitle(x.titleEn)) : 0);
      return { ...x, sameDoi, score };
    })
    .filter((x) => x.sameDoi || x.score >= 0.8)
    .sort((a, b) => Number(b.sameDoi) - Number(a.sameDoi) || b.score - a.score)
    .slice(0, 5);
}
