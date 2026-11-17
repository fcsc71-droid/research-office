import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DEGREE_LABELS, INDEXING_LABELS, INSTITUTE_NAME, WATERMARK_TEXT } from "@/lib/constants";
import { findPaperDuplicates, normalizeDoi } from "@/lib/duplicates";
import { generateReferenceNo } from "@/lib/research-service";
import type { AcademicDegree, IndexingType } from "@/generated/prisma/enums";

/** أعمدة قوالب الاستيراد (نموذج جمع البيانات الموحد من الأقسام العلمية) */
export const TEMPLATES = {
  researchers: {
    title: "نموذج بيانات أعضاء هيئة التدريس",
    columns: [
      ["الاسم الرباعي", true, "مثال: محمد علي سالم الفيتوري"],
      ["الرقم الوظيفي", true, "رقم فريد لكل عضو"],
      ["البريد الإلكتروني المؤسسي", true, "name@hiet.edu.ly"],
      ["رقم الهاتف", false, ""],
      ["القسم العلمي", true, "كما هو مسجل في المنظومة"],
      ["الدرجة العلمية", false, "محاضر / أستاذ مساعد / أستاذ مشارك / أستاذ دكتور / ماجستير / دكتوراه"],
      ["المسمى الوظيفي", false, ""],
      ["التخصص العام", false, ""],
      ["التخصص الدقيق", false, ""],
      ["المؤهل العلمي", false, ""],
      ["سنة الحصول على المؤهل", false, "2015"],
      ["الاهتمامات البحثية", false, "افصل بينها بفاصلة"],
      ["ORCID", false, "0000-0000-0000-0000"],
      ["Scopus Author ID", false, ""],
      ["Google Scholar", false, "رابط الملف"],
    ],
  },
  papers: {
    title: "نموذج البحوث المنشورة (آخر 5 سنوات)",
    columns: [
      ["عنوان البحث", true, "بالعربية أو الإنجليزية"],
      ["العنوان بالإنجليزية", false, ""],
      ["الرقم الوظيفي للباحث الرئيسي", true, "يجب أن يكون مسجلاً في المنظومة"],
      ["الباحثون المشاركون", false, "أسماء مفصولة بفاصلة"],
      ["سنة النشر", true, "2024"],
      ["اسم المجلة / المؤتمر", false, ""],
      ["ISSN", false, "1234-567X"],
      ["تصنيف المجلة", false, "Scopus / Web of Science / Scopus و Web of Science / أخرى / غير مفهرس"],
      ["DOI", false, "10.xxxx/xxxxx"],
      ["رابط البحث", false, "https://"],
      ["الكلمات المفتاحية", false, "مفصولة بفاصلة"],
      ["الملخص", false, ""],
    ],
  },
} as const;
export type ImportType = keyof typeof TEMPLATES;

export async function buildTemplate(type: ImportType) {
  const t = TEMPLATES[type];
  const wb = new ExcelJS.Workbook();
  wb.creator = INSTITUTE_NAME;
  const ws = wb.addWorksheet("البيانات", { views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }] });
  ws.headerFooter.oddFooter = `&C&9${WATERMARK_TEXT}`;
  ws.addRow([`${INSTITUTE_NAME} — مكتب البحث العلمي — ${t.title}`]).font = { bold: true, size: 13, color: { argb: "FF0F2A4A" } };
  ws.mergeCells(1, 1, 1, t.columns.length);
  ws.addRow(t.columns.map((c) => c[2])).font = { italic: true, size: 9, color: { argb: "FF6B7C93" } };
  const h = ws.addRow(t.columns.map((c) => (c[1] ? `${c[0]} *` : c[0])));
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2A4A" } };
    c.alignment = { horizontal: "center", wrapText: true };
  });
  t.columns.forEach((_, i) => (ws.getColumn(i + 1).width = 24));
  if (type === "researchers") {
    const depts = await db.department.findMany({ orderBy: { name: "asc" }, select: { name: true } });
    const ref = wb.addWorksheet("الأقسام", { views: [{ rightToLeft: true }] });
    ref.addRow(["الأقسام المسجلة في المنظومة"]).font = { bold: true };
    depts.forEach((d) => ref.addRow([d.name]));
    ref.getColumn(1).width = 40;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type ImportResult = { created: number; skipped: { row: number; reason: string }[] };

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink.trim();
    if ("result" in v) return String(v.result ?? "").trim();
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

/** قراءة الصفوف: يُحدَّد صف العناوين بالبحث عن أول عمود إلزامي */
async function readRows(buffer: Buffer, type: ImportType) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("الملف لا يحتوي على ورقة بيانات");
  const first = TEMPLATES[type].columns[0][0];
  let headerRow = 0;
  ws.eachRow((row, n) => {
    if (!headerRow && cellText(row.getCell(1).value).replace("*", "").trim() === first) headerRow = n;
  });
  if (!headerRow) throw new Error("لم يتم العثور على صف العناوين. استخدم القالب المعتمد دون تغيير ترتيب الأعمدة");
  const rows: { n: number; v: string[] }[] = [];
  ws.eachRow((row, n) => {
    if (n <= headerRow) return;
    const v = TEMPLATES[type].columns.map((_, i) => cellText(row.getCell(i + 1).value));
    if (v.some(Boolean)) rows.push({ n, v });
  });
  if (rows.length > 2000) throw new Error("الحد الأقصى 2000 صف في الملف الواحد");
  return rows;
}

const degreeByLabel = Object.fromEntries(Object.entries(DEGREE_LABELS).map(([k, v]) => [v, k])) as Record<string, AcademicDegree>;
Object.assign(degreeByLabel, { "دكتوراه": "PHD", "ماجستير": "MASTER", "محاضر": "LECTURER", "أستاذ": "PROFESSOR", "بكالوريوس": "BACHELOR" });

function parseIndexing(s: string): IndexingType {
  const t = s.toLowerCase();
  const sc = t.includes("scopus"), wos = t.includes("web of science") || t.includes("wos");
  if (sc && wos) return "SCOPUS_WOS";
  if (sc) return "SCOPUS";
  if (wos) return "WOS";
  if (!t || t.includes("غير")) return "NONE";
  return Object.entries(INDEXING_LABELS).find(([, v]) => v === s)?.[0] as IndexingType ?? "OTHER";
}

const splitList = (s: string) => [...new Set(s.split(/[,،;\n]/).map((x) => x.trim()).filter(Boolean))];

export async function importResearchers(buffer: Buffer, user: CurrentUser): Promise<ImportResult> {
  const rows = await readRows(buffer, "researchers");
  const depts = await db.department.findMany();
  const res: ImportResult = { created: 0, skipped: [] };
  for (const { n, v } of rows) {
    const [name, uid, email, phone, deptName, degree, jobTitle, gen, spec, qual, qYear, interests, orcid, scopus, scholar] = v;
    const skip = (reason: string) => res.skipped.push({ row: n, reason });
    if (!name || !uid || !email) { skip("حقول إلزامية ناقصة (الاسم، الرقم الوظيفي، البريد)"); continue; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { skip("بريد إلكتروني غير صالح"); continue; }
    const dept = depts.find((d) => d.name === deptName || d.name === `قسم ${deptName}` || d.name.replace(/^قسم\s+/, "") === deptName);
    if (!dept) { skip(`القسم «${deptName || "فارغ"}» غير مسجل في المنظومة`); continue; }
    if (orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid)) { skip("صيغة ORCID غير صحيحة"); continue; }
    const exists = await db.researcher.findFirst({ where: { OR: [{ universityId: uid }, { email: email.toLowerCase() }] } });
    if (exists) { skip("مسجل مسبقاً (نفس الرقم الوظيفي أو البريد)"); continue; }
    const year = Number(qYear);
    await db.researcher.create({
      data: {
        fullName: name.slice(0, 200), universityId: uid.slice(0, 50), email: email.toLowerCase().slice(0, 200), phone: phone || null,
        type: "FACULTY", academicDegree: degreeByLabel[degree] ?? "LECTURER", departmentId: dept.id, collegeId: dept.collegeId,
        jobTitle: jobTitle || "عضو هيئة تدريس", generalSpecialization: gen || null, specialization: spec || null, qualification: qual || null,
        qualificationYear: Number.isInteger(year) && year > 1950 && year < 2100 ? year : null, researchInterests: splitList(interests).slice(0, 15),
        orcid: orcid || null, scopusId: /^\d{5,15}$/.test(scopus) ? scopus : null, googleScholar: /^https?:\/\//.test(scholar) ? scholar : null,
      },
    });
    res.created++;
  }
  await audit({ userId: user.id, action: "CREATE", entity: "Researcher", summary: `استيراد أعضاء هيئة التدريس من Excel: ${res.created} مضاف، ${res.skipped.length} متجاوز` });
  return res;
}

export async function importPapers(buffer: Buffer, user: CurrentUser, approveNow: boolean): Promise<ImportResult> {
  const rows = await readRows(buffer, "papers");
  const res: ImportResult = { created: 0, skipped: [] };
  for (const { n, v } of rows) {
    const [titleAr, titleEn, uid, coAuthors, yearS, journalName, issn, indexingS, doiS, url, keywords, abstract] = v;
    const skip = (reason: string) => res.skipped.push({ row: n, reason });
    const year = Number(yearS);
    if (!titleAr || titleAr.length < 5 || !uid) { skip("حقول إلزامية ناقصة (العنوان، الرقم الوظيفي للباحث)"); continue; }
    if (!Number.isInteger(year) || year < 1950 || year > 2100) { skip("سنة النشر غير صالحة"); continue; }
    const main = await db.researcher.findUnique({ where: { universityId: uid } });
    if (!main) { skip(`الباحث برقم ${uid} غير مسجل — استورد أعضاء هيئة التدريس أولاً`); continue; }
    const doi = normalizeDoi(doiS);
    const dups = await findPaperDuplicates({ doi, titleAr, titleEn });
    if (dups.length) { skip(`مكرر محتمل للبحث ${dups[0].referenceNo}${dups[0].sameDoi ? " (نفس DOI)" : " (تشابه العنوان)"}`); continue; }
    const journal = issn ? await db.journal.findUnique({ where: { issn: issn.toUpperCase() } }) : journalName ? await db.journal.findFirst({ where: { name: journalName } }) : null;
    const coNames = splitList(coAuthors).slice(0, 20);
    const coResearchers = coNames.length ? await db.researcher.findMany({ where: { fullName: { in: coNames } } }) : [];
    const now = new Date();
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        await db.researchPaper.create({
          data: {
            referenceNo: await generateReferenceNo(), titleAr: titleAr.slice(0, 500), titleEn: titleEn || null,
            abstract: abstract && abstract.length >= 20 ? abstract.slice(0, 8000) : "لم يُدخل ملخص (سجل مستورد من ملف Excel)",
            keywords: splitList(keywords).slice(0, 15), mainResearcherId: main.id, departmentId: main.departmentId, collegeId: main.collegeId,
            type: "JOURNAL_ARTICLE", level: "FACULTY", recordKind: "PUBLISHED_RECORD",
            journalId: journal?.id ?? null, journalName: journal ? null : journalName || null, indexing: journal?.indexing ?? parseIndexing(indexingS),
            doi, url: /^https?:\/\//.test(url) ? url : null, publicationYear: year,
            status: approveNow ? "PUBLISHED" : "SUBMITTED", submittedAt: now,
            ...(approveNow ? { publishedAt: now, decidedAt: now, decisionAccepted: true } : {}),
            createdById: user.id,
            authors: {
              create: [
                { name: main.fullName, researcherId: main.id, role: "MAIN", order: 0 },
                ...coNames.map((nm, i) => ({ name: nm, researcherId: coResearchers.find((c) => c.fullName === nm)?.id ?? null, role: "CO_AUTHOR" as const, order: i + 1 })),
              ],
            },
            versions: { create: { versionNo: 1, note: "مستورد من ملف Excel", createdById: user.id } },
            statusHistory: { create: { toStatus: approveNow ? "PUBLISHED" : "SUBMITTED", changedById: user.id, note: "استيراد من ملف Excel" } },
          },
        });
        created = true;
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e;
      }
    }
    res.created++;
  }
  await audit({ userId: user.id, action: "CREATE", entity: "ResearchPaper", summary: `استيراد البحوث المنشورة من Excel: ${res.created} مضاف، ${res.skipped.length} متجاوز` });
  return res;
}
