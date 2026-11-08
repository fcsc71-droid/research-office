import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  ASSIGNMENT_STATUS_LABELS,
  DEGREE_LABELS,
  RECOMMENDATION_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const REPORT_TYPES = {
  period: "تقرير الأبحاث حسب الفترة الزمنية",
  decisions: "تقرير الأبحاث المقبولة والمرفوضة",
  departments: "تقرير الأبحاث حسب القسم",
  researchers: "تقرير نشاط الباحثين",
  reviews: "تقرير التحكيم العلمي",
  in_progress: "تقرير الأبحاث قيد الإنجاز",
  published: "تقرير الأبحاث المنشورة",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;

export type ReportFilters = {
  type: ReportType;
  from?: string;
  to?: string;
  collegeId?: string;
  departmentId?: string;
  q?: string;
};

export type ReportData = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: (string | number)[][];
  summary: { label: string; value: string | number }[];
};

export function parseReportFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const g = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const type = (g("type") ?? "period") as ReportType;
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  return {
    type: type in REPORT_TYPES ? type : "period",
    from: g("from") && valid.test(g("from")!) ? g("from") : undefined,
    to: g("to") && valid.test(g("to")!) ? g("to") : undefined,
    collegeId: g("collegeId"),
    departmentId: g("departmentId"),
    q: g("q")?.slice(0, 100),
  };
}

function range(f: ReportFilters): Prisma.DateTimeNullableFilter | undefined {
  if (!f.from && !f.to) return undefined;
  return {
    ...(f.from ? { gte: new Date(f.from + "T00:00:00") } : {}),
    ...(f.to ? { lte: new Date(f.to + "T23:59:59") } : {}),
  };
}

function paperBase(f: ReportFilters): Prisma.ResearchPaperWhereInput {
  const w: Prisma.ResearchPaperWhereInput = {};
  if (f.collegeId) w.collegeId = f.collegeId;
  if (f.departmentId) w.departmentId = f.departmentId;
  if (f.q)
    w.OR = [
      { titleAr: { contains: f.q, mode: "insensitive" } },
      { titleEn: { contains: f.q, mode: "insensitive" } },
      { referenceNo: { contains: f.q, mode: "insensitive" } },
      { keywords: { has: f.q } },
      { mainResearcher: { fullName: { contains: f.q, mode: "insensitive" } } },
    ];
  return w;
}

const paperInclude = {
  mainResearcher: { select: { fullName: true } },
  college: { select: { name: true } },
  department: { select: { name: true } },
} satisfies Prisma.ResearchPaperInclude;

function periodLabel(f: ReportFilters) {
  if (!f.from && !f.to) return "جميع الفترات";
  return `الفترة من ${f.from ? formatDate(f.from) : "البداية"} إلى ${f.to ? formatDate(f.to) : "اليوم"}`;
}

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return m;
}

export async function buildReport(f: ReportFilters): Promise<ReportData> {
  const subtitle = periodLabel(f);
  const title = REPORT_TYPES[f.type];
  const r = range(f);

  switch (f.type) {
    case "period":
    case "in_progress":
    case "published": {
      const where: Prisma.ResearchPaperWhereInput = { ...paperBase(f) };
      if (f.type === "period") where.createdAt = r as Prisma.DateTimeFilter | undefined;
      if (f.type === "in_progress") {
        where.status = { in: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "NEEDS_REVISION", "RESUBMITTED"] };
        if (r) where.submittedAt = r;
      }
      if (f.type === "published") {
        where.OR = undefined;
        where.AND = [paperBase(f), { OR: [{ status: "PUBLISHED" }, { publishedAt: { not: null } }] }];
        if (r) where.publishedAt = r;
      }
      const papers = await db.researchPaper.findMany({ where, include: paperInclude, orderBy: { createdAt: "desc" } });
      const byStatus = countBy(papers, (p) => STATUS_LABELS[p.status]);
      return {
        title,
        subtitle,
        columns: [
          "الرقم المرجعي", "عنوان البحث", "الباحث الرئيسي", "الكلية", "القسم", "النوع", "الحالة",
          f.type === "published" ? "تاريخ النشر" : "تاريخ التقديم",
        ],
        rows: papers.map((p) => [
          p.referenceNo, p.titleAr, p.mainResearcher.fullName, p.college?.name ?? "—", p.department?.name ?? "—",
          TYPE_LABELS[p.type], STATUS_LABELS[p.status],
          formatDate(f.type === "published" ? p.publishedAt : p.submittedAt),
        ]),
        summary: [{ label: "إجمالي الأبحاث", value: papers.length }, ...[...byStatus].map(([label, value]) => ({ label, value }))],
      };
    }
    case "decisions": {
      const papers = await db.researchPaper.findMany({
        where: {
          AND: [
            paperBase(f),
            { decidedAt: r ?? { not: null } },
            { status: { in: ["ACCEPTED", "REJECTED", "PUBLISHED", "ARCHIVED"] } },
          ],
        },
        include: paperInclude,
        orderBy: { decidedAt: "desc" },
      });
      const isRejected = (p: (typeof papers)[number]) => p.status === "REJECTED" || p.decisionAccepted === false;
      const accepted = papers.filter((p) => !isRejected(p)).length;
      const rejected = papers.filter(isRejected).length;
      return {
        title,
        subtitle,
        columns: ["الرقم المرجعي", "عنوان البحث", "الباحث الرئيسي", "القسم", "القرار", "الحالة الحالية", "تاريخ القرار"],
        rows: papers.map((p) => [
          p.referenceNo, p.titleAr, p.mainResearcher.fullName, p.department?.name ?? "—",
          isRejected(p) ? "مرفوض" : "مقبول", STATUS_LABELS[p.status], formatDate(p.decidedAt),
        ]),
        summary: [
          { label: "إجمالي القرارات", value: papers.length },
          { label: "مقبول", value: accepted },
          { label: "مرفوض", value: rejected },
          { label: "نسبة القبول", value: papers.length ? `${Math.round((accepted / papers.length) * 100)}%` : "—" },
        ],
      };
    }
    case "departments": {
      const depts = await db.department.findMany({
        where: { ...(f.collegeId ? { collegeId: f.collegeId } : {}), ...(f.departmentId ? { id: f.departmentId } : {}) },
        include: {
          college: { select: { name: true } },
          papers: { where: { ...(r ? { createdAt: r as Prisma.DateTimeFilter } : {}) }, select: { status: true } },
        },
        orderBy: [{ college: { name: "asc" } }, { name: "asc" }],
      });
      const rows = depts.map((d) => {
        const c = (s: string[]) => d.papers.filter((p) => s.includes(p.status)).length;
        return [
          d.college.name, d.name, d.papers.length,
          c(["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "NEEDS_REVISION", "RESUBMITTED"]),
          c(["ACCEPTED"]), c(["REJECTED"]), c(["PUBLISHED"]), c(["ARCHIVED"]),
        ];
      });
      const total = rows.reduce((s, r) => s + (r[2] as number), 0);
      return {
        title,
        subtitle,
        columns: ["الكلية", "القسم", "الإجمالي", "قيد الإنجاز", "مقبول", "مرفوض", "منشور", "مؤرشف"],
        rows,
        summary: [{ label: "عدد الأقسام", value: depts.length }, { label: "إجمالي الأبحاث", value: total }],
      };
    }
    case "researchers": {
      const researchers = await db.researcher.findMany({
        where: {
          ...(f.collegeId ? { collegeId: f.collegeId } : {}),
          ...(f.departmentId ? { departmentId: f.departmentId } : {}),
          ...(f.q ? { OR: [{ fullName: { contains: f.q, mode: "insensitive" } }, { universityId: { contains: f.q } }] } : {}),
        },
        include: {
          department: { select: { name: true } },
          mainPapers: { where: r ? { createdAt: r as Prisma.DateTimeFilter } : {}, select: { status: true, submittedAt: true } },
          authorships: { where: { role: "CO_AUTHOR", ...(r ? { paper: { createdAt: r as Prisma.DateTimeFilter } } : {}) }, select: { id: true } },
        },
        orderBy: { fullName: "asc" },
      });
      const rows = researchers
        .map((x) => {
          const last = x.mainPapers.map((p) => p.submittedAt).filter(Boolean).sort((a, b) => +b! - +a!)[0];
          return [
            x.fullName, x.universityId, x.department?.name ?? "—", DEGREE_LABELS[x.academicDegree],
            x.mainPapers.length, x.authorships.length,
            x.mainPapers.filter((p) => ["ACCEPTED", "PUBLISHED"].includes(p.status)).length,
            x.mainPapers.filter((p) => p.status === "PUBLISHED").length,
            formatDate(last),
          ];
        })
        .sort((a, b) => (b[4] as number) - (a[4] as number));
      return {
        title,
        subtitle,
        columns: ["الباحث", "الرقم الجامعي/الوظيفي", "القسم", "الدرجة العلمية", "أبحاث رئيسية", "مشاركات", "مقبولة", "منشورة", "آخر تقديم"],
        rows,
        summary: [
          { label: "عدد الباحثين", value: researchers.length },
          { label: "الباحثون النشطون", value: rows.filter((r) => (r[4] as number) + (r[5] as number) > 0).length },
        ],
      };
    }
    case "reviews": {
      const list = await db.reviewAssignment.findMany({
        where: {
          ...(r ? { assignedAt: r as Prisma.DateTimeFilter } : {}),
          paper: paperBase(f),
        },
        include: {
          paper: { select: { referenceNo: true, titleAr: true } },
          reviewer: { select: { name: true } },
          review: { select: { recommendation: true, overallScore: true, isDraft: true } },
        },
        orderBy: { assignedAt: "desc" },
      });
      const submitted = list.filter((a) => a.status === "SUBMITTED");
      const late = list.filter((a) => ["PENDING", "IN_PROGRESS"].includes(a.status) && a.dueDate < new Date()).length;
      const avg = submitted.length
        ? (submitted.reduce((s, a) => s + (a.review?.overallScore ?? 0), 0) / submitted.length).toFixed(1)
        : "—";
      return {
        title,
        subtitle,
        columns: ["الرقم المرجعي", "عنوان البحث", "المحكم", "الجولة", "تاريخ التكليف", "موعد التسليم", "الحالة", "التوصية", "الدرجة /10"],
        rows: list.map((a) => [
          a.paper.referenceNo, a.paper.titleAr, a.reviewer.name, a.round, formatDate(a.assignedAt), formatDate(a.dueDate),
          ASSIGNMENT_STATUS_LABELS[a.status],
          a.review && !a.review.isDraft ? RECOMMENDATION_LABELS[a.review.recommendation] : "—",
          a.review && !a.review.isDraft ? a.review.overallScore.toFixed(1) : "—",
        ]),
        summary: [
          { label: "إجمالي التكليفات", value: list.length },
          { label: "تقييمات مسلمة", value: submitted.length },
          { label: "متأخرة", value: late },
          { label: "متوسط الدرجات", value: avg },
        ],
      };
    }
  }
}
