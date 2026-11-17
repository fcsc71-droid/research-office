import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  INDEXING_LABELS, EVENT_TYPE_LABELS, EVENT_SCOPE_LABELS, PARTICIPATION_ROLE_LABELS, PROJECT_STATUS_LABELS,
  AWARD_TYPE_LABELS, COLLABORATION_TYPE_LABELS, PARTNER_TYPE_LABELS,
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
  indexed: "تقرير البحوث المنشورة في Scopus و Web of Science",
  faculty_output: "تقرير الإنتاج العلمي لأعضاء هيئة التدريس",
  conferences: "تقرير المشاركات في المؤتمرات والفعاليات العلمية",
  activities: "تقرير الأنشطة العلمية التي نظمها المعهد",
  projects: "تقرير المشاريع البحثية",
  awards: "تقرير الجوائز والتكريم",
  collaborations: "تقرير التعاون البحثي",
  annual: "التقرير السنوي لمكتب البحث العلمي",
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

const PUBLISHED_WHERE: Prisma.ResearchPaperWhereInput = { OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED", publishedAt: { not: null } }] };

/** نطاق السنة: يعتمد سنة النشر إن وجدت وإلا تاريخ النشر */
function yearRange(f: ReportFilters): Prisma.ResearchPaperWhereInput {
  if (!f.from && !f.to) return {};
  const fy = f.from ? Number(f.from.slice(0, 4)) : 1900;
  const ty = f.to ? Number(f.to.slice(0, 4)) : 3000;
  const r = range(f);
  return { OR: [{ publicationYear: { gte: fy, lte: ty } }, { publicationYear: null, publishedAt: r }] };
}

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
    case "indexed": {
      const papers = await db.researchPaper.findMany({
        where: { AND: [paperBase(f), { indexing: { in: ["SCOPUS", "WOS", "SCOPUS_WOS"] } }, PUBLISHED_WHERE, yearRange(f)] },
        include: { ...paperInclude, journal: { select: { name: true, quartile: true } } },
        orderBy: [{ publicationYear: "desc" }],
      });
      const n = (k: string[]) => papers.filter((p) => k.includes(p.indexing)).length;
      return {
        title, subtitle,
        columns: ["عنوان البحث", "الباحث الرئيسي", "القسم", "المجلة", "الربع", "الفهرسة", "سنة النشر", "DOI"],
        rows: papers.map((p) => [p.titleAr, p.mainResearcher.fullName, p.department?.name ?? "—", p.journal?.name ?? p.journalName ?? "—",
          p.journal && p.journal.quartile !== "NONE" ? p.journal.quartile : "—", INDEXING_LABELS[p.indexing], p.publicationYear ?? "—", p.doi ?? "—"]),
        summary: [
          { label: "إجمالي البحوث المفهرسة", value: papers.length },
          { label: "في Scopus", value: n(["SCOPUS", "SCOPUS_WOS"]) },
          { label: "في Web of Science", value: n(["WOS", "SCOPUS_WOS"]) },
        ],
      };
    }
    case "faculty_output": {
      const faculty = await db.researcher.findMany({
        where: { type: "FACULTY", ...(f.collegeId ? { collegeId: f.collegeId } : {}), ...(f.departmentId ? { departmentId: f.departmentId } : {}) },
        include: {
          department: { select: { name: true } },
          authorships: { where: { paper: { AND: [PUBLISHED_WHERE, yearRange(f)] } }, select: { paper: { select: { indexing: true } } } },
          eventParticipations: { where: { event: { approval: "APPROVED", ...(r ? { startDate: r as Prisma.DateTimeFilter } : {}) } }, select: { id: true } },
          projectsLed: { where: { approval: "APPROVED" }, select: { id: true } },
          projectMemberships: { where: { project: { approval: "APPROVED" } }, select: { id: true } },
          awards: { where: { approval: "APPROVED" }, select: { id: true } },
        },
        orderBy: { fullName: "asc" },
      });
      const rows = faculty.map((x) => {
        const pubs = x.authorships.length;
        const idx = x.authorships.filter((a) => ["SCOPUS", "WOS", "SCOPUS_WOS"].includes(a.paper.indexing)).length;
        return [x.fullName, x.department?.name ?? "—", DEGREE_LABELS[x.academicDegree], pubs, idx, x.eventParticipations.length,
          x.projectsLed.length + x.projectMemberships.length, x.awards.length, x.orcid || x.scopusId || x.googleScholar ? "نعم" : "لا"];
      });
      const active = rows.filter((r) => (r[3] as number) > 0).length;
      return {
        title, subtitle,
        columns: ["عضو هيئة التدريس", "القسم", "الدرجة", "بحوث منشورة", "Scopus/WoS", "مؤتمرات وأنشطة", "مشاريع", "جوائز", "معرفات علمية"],
        rows: rows.sort((a, b) => (b[3] as number) - (a[3] as number)),
        summary: [
          { label: "عدد أعضاء هيئة التدريس", value: faculty.length },
          { label: "لديهم إنتاج علمي منشور", value: active },
          { label: "نسبة أعضاء هيئة التدريس ذوي الإنتاج العلمي", value: faculty.length ? `${Math.round((active / faculty.length) * 100)}%` : "—" },
          { label: "المشاركون في البحث العلمي (أي نشاط)", value: rows.filter((r) => (r[3] as number) + (r[5] as number) + (r[6] as number) > 0).length },
        ],
      };
    }
    case "conferences":
    case "activities": {
      const institute = f.type === "activities";
      const events = await db.scientificEvent.findMany({
        where: {
          organizedByInstitute: institute, approval: "APPROVED",
          ...(r ? { startDate: r as Prisma.DateTimeFilter } : {}),
          ...(f.departmentId ? { participants: { some: { researcher: { departmentId: f.departmentId } } } } : {}),
          ...(f.q ? { name: { contains: f.q, mode: "insensitive" as const } } : {}),
        },
        include: { participants: { include: { researcher: { select: { fullName: true } } } } },
        orderBy: { startDate: "desc" },
      });
      const byType = countBy(events, (e) => EVENT_TYPE_LABELS[e.type]);
      return {
        title, subtitle,
        columns: institute
          ? ["النشاط", "النوع", "النطاق", "التاريخ", "المكان", "المنظمون", "عدد الحضور"]
          : ["الفعالية", "النوع", "النطاق", "الجهة المنظمة", "التاريخ", "المشاركون ونوع المشاركة"],
        rows: events.map((e) => institute
          ? [e.name, EVENT_TYPE_LABELS[e.type], EVENT_SCOPE_LABELS[e.scope], formatDate(e.startDate), e.location ?? "—", e.participants.map((p) => p.researcher.fullName).join("، ") || "—", e.attendeesCount ?? "—"]
          : [e.name, EVENT_TYPE_LABELS[e.type], EVENT_SCOPE_LABELS[e.scope], e.organizer ?? "—", formatDate(e.startDate), e.participants.map((p) => `${p.researcher.fullName} (${PARTICIPATION_ROLE_LABELS[p.role]})`).join("، ")]),
        summary: [
          { label: institute ? "عدد الأنشطة" : "عدد الفعاليات", value: events.length },
          ...(!institute ? [{ label: "إجمالي المشاركات", value: events.reduce((a, e) => a + e.participants.length, 0) }, { label: "دولية", value: events.filter((e) => e.scope === "INTERNATIONAL").length }] : []),
          ...[...byType].map(([label, value]) => ({ label, value })),
        ],
      };
    }
    case "projects": {
      const list = await db.researchProject.findMany({
        where: { approval: "APPROVED", ...(f.departmentId ? { departmentId: f.departmentId } : {}), ...(r ? { createdAt: r as Prisma.DateTimeFilter } : {}), ...(f.q ? { title: { contains: f.q, mode: "insensitive" as const } } : {}) },
        include: { lead: { select: { fullName: true } }, department: { select: { name: true } }, members: true, reports: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
      });
      const byStatus = countBy(list, (p) => PROJECT_STATUS_LABELS[p.status]);
      return {
        title, subtitle,
        columns: ["المشروع", "الباحث الرئيسي", "القسم", "عدد الفريق", "البداية", "النهاية المتوقعة", "المرحلة", "الإنجاز", "الجهات المتعاونة"],
        rows: list.map((p) => [p.title, p.lead.fullName, p.department?.name ?? "—", p.members.length + 1, formatDate(p.startDate), formatDate(p.expectedEndDate),
          PROJECT_STATUS_LABELS[p.status], `${p.reports[0]?.progress ?? 0}%`, p.partners ?? "—"]),
        summary: [
          { label: "إجمالي المشاريع", value: list.length },
          { label: "المشاريع النشطة", value: list.filter((p) => ["APPROVED", "IN_PROGRESS"].includes(p.status)).length },
          ...[...byStatus].map(([label, value]) => ({ label, value })),
        ],
      };
    }
    case "awards": {
      const list = await db.award.findMany({
        where: { approval: "APPROVED", ...(r ? { date: r as Prisma.DateTimeFilter } : {}), ...(f.departmentId ? { researcher: { departmentId: f.departmentId } } : {}) },
        include: { researcher: { select: { fullName: true, department: { select: { name: true } } } } },
        orderBy: { date: "desc" },
      });
      return {
        title, subtitle,
        columns: ["الجائزة", "عضو هيئة التدريس", "القسم", "النوع", "الجهة المانحة", "التاريخ"],
        rows: list.map((w) => [w.title, w.researcher.fullName, w.researcher.department?.name ?? "—", AWARD_TYPE_LABELS[w.type], w.grantor ?? "—", formatDate(w.date)]),
        summary: [{ label: "إجمالي الجوائز", value: list.length }, ...[...countBy(list, (w) => AWARD_TYPE_LABELS[w.type])].map(([label, value]) => ({ label, value }))],
      };
    }
    case "collaborations": {
      const list = await db.collaboration.findMany({ where: r ? { startDate: r } : {}, orderBy: { startDate: "desc" } });
      const now = new Date();
      return {
        title, subtitle,
        columns: ["الجهة", "نوع الجهة", "نوع التعاون", "العنوان", "البداية", "الانتهاء", "الحالة"],
        rows: list.map((c) => [c.partnerName, PARTNER_TYPE_LABELS[c.partnerType], COLLABORATION_TYPE_LABELS[c.type], c.title, formatDate(c.startDate), formatDate(c.endDate), !c.endDate || c.endDate >= now ? "سارية" : "منتهية"]),
        summary: [{ label: "إجمالي الاتفاقيات والتعاونات", value: list.length }, { label: "السارية", value: list.filter((c) => !c.endDate || c.endDate >= now).length }],
      };
    }
    case "annual": {
      const depts = await db.department.findMany({ orderBy: { name: "asc" }, include: { college: { select: { name: true } } } });
      const rows: (string | number)[][] = [];
      let tot = [0, 0, 0, 0, 0, 0];
      for (const d of depts) {
        const [faculty, pubs, indexed, events, projects, awards] = await Promise.all([
          db.researcher.count({ where: { departmentId: d.id, type: "FACULTY" } }),
          db.researchPaper.count({ where: { AND: [{ departmentId: d.id }, PUBLISHED_WHERE, yearRange(f)] } }),
          db.researchPaper.count({ where: { AND: [{ departmentId: d.id }, PUBLISHED_WHERE, yearRange(f), { indexing: { in: ["SCOPUS", "WOS", "SCOPUS_WOS"] } }] } }),
          db.eventParticipant.count({ where: { researcher: { departmentId: d.id }, event: { approval: "APPROVED", ...(r ? { startDate: r as Prisma.DateTimeFilter } : {}) } } }),
          db.researchProject.count({ where: { departmentId: d.id, approval: "APPROVED", status: { in: ["APPROVED", "IN_PROGRESS", "COMPLETED", "PUBLISHED"] } } }),
          db.award.count({ where: { approval: "APPROVED", researcher: { departmentId: d.id }, ...(r ? { date: r as Prisma.DateTimeFilter } : {}) } }),
        ]);
        const v = [faculty, pubs, indexed, events, projects, awards];
        tot = tot.map((t, i) => t + v[i]);
        rows.push([d.name, ...v]);
      }
      const activities = await db.scientificEvent.count({ where: { organizedByInstitute: true, approval: "APPROVED", ...(r ? { startDate: r as Prisma.DateTimeFilter } : {}) } });
      const collabs = await db.collaboration.count();
      rows.push(["الإجمالي", ...tot]);
      return {
        title, subtitle,
        columns: ["القسم العلمي", "أعضاء هيئة التدريس", "البحوث المنشورة", "Scopus / WoS", "المشاركات العلمية", "المشاريع البحثية", "الجوائز"],
        rows,
        summary: [
          { label: "البحوث المنشورة", value: tot[1] },
          { label: "المنشورة في Scopus/WoS", value: tot[2] },
          { label: "المشاركات في المؤتمرات والفعاليات", value: tot[3] },
          { label: "المشاريع البحثية", value: tot[4] },
          { label: "الأنشطة التي نظمها المعهد", value: activities },
          { label: "الجوائز", value: tot[5] },
          { label: "اتفاقيات التعاون", value: collabs },
        ],
      };
    }
  }
}
