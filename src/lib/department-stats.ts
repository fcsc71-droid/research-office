import "server-only";
import { db } from "@/lib/db";

const INDEXED = ["SCOPUS", "WOS", "SCOPUS_WOS"] as const;

/** إحصاءات الملف البحثي للقسم (السجلات المعتمدة فقط) */
export async function departmentStats(departmentId: string) {
  const [faculty, papers, projects, events, awards] = await Promise.all([
    db.researcher.findMany({ where: { departmentId }, select: { id: true, fullName: true, specialization: true, generalSpecialization: true, researchInterests: true, academicDegree: true, type: true } }),
    db.researchPaper.findMany({
      where: { departmentId, OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED", publishedAt: { not: null } }] },
      select: { id: true, titleAr: true, publicationYear: true, publishedAt: true, indexing: true, referenceNo: true },
      orderBy: { publishedAt: "desc" },
    }),
    db.researchProject.findMany({ where: { departmentId, approval: "APPROVED" }, select: { id: true, title: true, status: true } }),
    db.scientificEvent.findMany({
      where: { approval: "APPROVED", participants: { some: { researcher: { departmentId } } } },
      select: { id: true, name: true, type: true, startDate: true, organizedByInstitute: true },
      orderBy: { startDate: "desc" },
    }),
    db.award.count({ where: { approval: "APPROVED", researcher: { departmentId } } }),
  ]);
  const byYear = new Map<number, number>();
  for (const p of papers) {
    const y = p.publicationYear ?? p.publishedAt?.getFullYear();
    if (y) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const interests = new Map<string, number>();
  for (const f of faculty) for (const i of f.researchInterests) interests.set(i, (interests.get(i) ?? 0) + 1);
  const specs = [...new Set(faculty.flatMap((f) => [f.generalSpecialization, f.specialization]).filter(Boolean) as string[])];
  return {
    faculty, papers, projects, events, awards,
    indexed: papers.filter((p) => (INDEXED as readonly string[]).includes(p.indexing)).length,
    byYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, value]) => ({ name: String(y), value })),
    topInterests: [...interests.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    specializations: specs,
  };
}
