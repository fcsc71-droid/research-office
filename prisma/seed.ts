/**
 * تهيئة قاعدة البيانات
 *  - الأساسيات (دائماً): الأدوار، الصلاحيات، الإعدادات، حساب مدير النظام.
 *  - بيانات تجريبية (بيئة التطوير فقط): كليات، أقسام، مستخدمون، باحثون، أبحاث، تحكيم...
 *
 * الاستخدام:
 *   npm run db:seed            ← أساسيات + بيانات تجريبية (يرفض العمل في الإنتاج)
 *   npm run db:seed -- --base  ← الأساسيات فقط (آمن للإنتاج)
 */
import "dotenv/config";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ResearchStatus, ResearchType, ResearchLevel, AcademicDegree, ReviewRecommendation } from "../src/generated/prisma/enums";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_LABELS, type RoleKey } from "../src/lib/constants";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const db = client;
type Tx = Parameters<Parameters<typeof client.$transaction>[0]>[0];
const BASE_ONLY = process.argv.includes("--base");
const STORAGE = path.resolve(process.env.STORAGE_DIR || "./storage");

async function seedBase() {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({ where: { code: p.code }, create: { code: p.code, name: p.name, group: p.group }, update: { name: p.name, group: p.group } });
  }
  const perms = await db.permission.findMany();
  const byCode = new Map(perms.map((p) => [p.code, p.id]));
  // الصلاحيات التي سبق تطبيقها افتراضياً — لإضافة الصلاحيات الجديدة فقط دون المساس بتعديلات المدير
  const appliedRow = await db.systemSetting.findUnique({ where: { key: "appliedDefaultPermissions" } });
  const applied = new Set<string>(Array.isArray(appliedRow?.value) ? (appliedRow!.value as string[]) : []);
  for (const key of Object.keys(DEFAULT_ROLE_PERMISSIONS) as RoleKey[]) {
    const role = await db.role.upsert({
      where: { key },
      create: { key, name: ROLE_LABELS[key], isSystem: true },
      update: { name: ROLE_LABELS[key] },
    });
    const existing = await db.rolePermission.count({ where: { roleId: role.id } });
    const codes =
      existing === 0 || key === "ADMIN"
        ? DEFAULT_ROLE_PERMISSIONS[key]
        : DEFAULT_ROLE_PERMISSIONS[key].filter((c) => !applied.has(c));
    if (codes.length) {
      await db.rolePermission.createMany({
        data: codes.map((c) => ({ roleId: role.id, permissionId: byCode.get(c)! })),
        skipDuplicates: true,
      });
    }
  }
  const allCodes = PERMISSIONS.map((p) => p.code);
  await db.systemSetting.upsert({
    where: { key: "appliedDefaultPermissions" },
    create: { key: "appliedDefaultPermissions", value: allCodes },
    update: { value: allCodes },
  });
  const adminRole = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@research.local").toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "Password@123";
  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "مدير النظام", passwordHash: await bcrypt.hash(adminPass, 12), roleId: adminRole.id },
    update: {},
  });
  console.log("✔ الأدوار والصلاحيات وحساب المدير:", adminEmail);
}

// ───────────────────────── البيانات التجريبية ─────────────────────────

async function makePdf(title: string, ref: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 2; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText("DEMO DATA - Sample research document", { x: 50, y: 790, size: 10, font: bold, color: rgb(0.7, 0.1, 0.1) });
    page.drawText(title.slice(0, 70), { x: 50, y: 750, size: 16, font: bold, color: rgb(0.06, 0.16, 0.29) });
    page.drawText(`Reference: ${ref}   |   Page ${i + 1}`, { x: 50, y: 725, size: 11, font });
    const lorem =
      "This is an automatically generated placeholder file used for development and testing only. It does not contain real research content.";
    let y = 690;
    for (let k = 0; k < 18; k++) {
      page.drawText(lorem.slice(0, 95), { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.25) });
      y -= 18;
    }
  }
  return Buffer.from(await doc.save());
}

async function storeDemoFile(buf: Buffer, ext: string) {
  const rel = path.posix.join("uploads", "demo", `${randomUUID()}.${ext}`);
  await fs.mkdir(path.join(STORAGE, "uploads", "demo"), { recursive: true });
  await fs.writeFile(path.join(STORAGE, rel), buf);
  return { storageKey: rel, sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length };
}

const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length];
const daysAgo = (d: number) => new Date(Date.now() - d * 86400 * 1000);

async function seedDemo() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_DATA !== "true") {
    console.log("⚠ تم تجاهل البيانات التجريبية في بيئة الإنتاج (ALLOW_DEMO_DATA=true لتفعيلها في نسخة العرض)");
    return;
  }
  if ((await db.researchPaper.count()) > 0 || (await db.college.count()) > 0) {
    // قاعدة بيانات تجريبية سابقة: نضيف بيانات الوحدات الجديدة مرة واحدة فقط
    const demo = await db.systemSetting.findUnique({ where: { key: "demoData" } });
    if (demo?.value === true && (await db.journal.count()) === 0) {
      await client.$transaction((tx) => seedDemoModules(tx), { timeout: 300_000, maxWait: 20_000 });
      console.log("✔ تمت إضافة البيانات التجريبية للوحدات الجديدة");
    } else console.log("ℹ توجد بيانات مسبقاً — تم تخطي البيانات التجريبية");
    return;
  }
  // تنفيذ كامل البيانات التجريبية في معاملة واحدة (إما تنجح كلها أو لا شيء)
  await client.$transaction(async (tx) => { await seedDemoData(tx); await seedDemoModules(tx); }, { timeout: 300_000, maxWait: 20_000 });
  console.log("✔ تم إنشاء البيانات التجريبية (بيئة التطوير)");
}

async function seedDemoData(db: Tx) {
  const pass = await bcrypt.hash("Password@123", 12);
  const role = async (k: string) => (await db.role.findUniqueOrThrow({ where: { key: k } })).id;

  // الهيكل الأكاديمي
  const structure: Record<string, string[]> = {
    "المعهد العالي للتقنيات الهندسية – بنغازي": [
      "قسم التقنيات المدنية", "قسم التقنيات الكهربائية والإلكترونية", "قسم التقنيات الميكانيكية",
      "قسم تقنية الحاسوب", "قسم التقنيات المعمارية", "قسم تقنيات النفط والغاز", "قسم العلوم العامة",
    ],
  };
  const depts: { id: string; collegeId: string; name: string }[] = [];
  let ci = 1;
  for (const [college, dlist] of Object.entries(structure)) {
    const c = await db.college.create({ data: { name: college, code: `C${ci++}` } });
    for (const d of dlist) depts.push(await db.department.create({ data: { name: d, collegeId: c.id } }));
  }
  const categories = await Promise.all(
    ["هندسة الطرق والنقل", "الإنشاءات والمواد", "الطاقة المتجددة", "أنظمة القوى الكهربائية", "الذكاء الاصطناعي", "أمن المعلومات", "التصنيع والمواد", "البيئة والمياه"].map(
      (name) => db.researchCategory.create({ data: { name } }),
    ),
  );

  // المستخدمون الأساسيون
  const manager = await db.user.create({ data: { name: "د. خالد العبيدي", email: "manager@research.local", passwordHash: pass, roleId: await role("OFFICE_MANAGER"), phone: "0500000001" } });
  const staff = await db.user.create({ data: { name: "سارة الورفلي", email: "staff@research.local", passwordHash: pass, roleId: await role("STAFF"), phone: "0500000002" } });
  const reviewerRole = await role("REVIEWER");
  const reviewersData = [
    ["أ.د. محمد الزوي", "reviewer@research.local", "أستاذ دكتور", "الذكاء الاصطناعي"],
    ["د. نورة المسماري", "reviewer2@research.local", "أستاذ مشارك", "هندسة الطرق والنقل"],
    ["د. فرج البرعصي", "reviewer3@research.local", "أستاذ مساعد", "أنظمة القوى الكهربائية"],
    ["د. منى الشريف", "reviewer4@research.local", "أستاذ مشارك", "الطاقة المتجددة"],
  ];
  const reviewers = [];
  for (const [i, [name, email, title, spec]] of reviewersData.entries()) {
    reviewers.push(
      await db.user.create({
        data: { name, email, passwordHash: pass, roleId: reviewerRole, academicTitle: title, specialization: spec, institution: "جامعة بنغازي", departmentId: depts[(i * 2) % depts.length].id, collegeId: depts[(i * 2) % depts.length].collegeId },
      }),
    );
  }

  // الباحثون
  const researcherRole = await role("RESEARCHER");
  const people: [string, AcademicDegree, "STUDENT" | "FACULTY"][] = [
    ["م. ريم عبدالله الفيتوري", "MASTER", "FACULTY"],
    ["د. عبدالرحمن ناصر المغربي", "PHD", "FACULTY"],
    ["م. لمى سعد العقوري", "MASTER", "FACULTY"],
    ["د. هند علي الكيلاني", "ASSISTANT_PROFESSOR", "FACULTY"],
    ["م. يوسف إبراهيم الترهوني", "MASTER", "FACULTY"],
    ["م. جود فيصل الحاسي", "LECTURER", "FACULTY"],
    ["د. عمر حسن الدرسي", "ASSOCIATE_PROFESSOR", "FACULTY"],
    ["م. شهد محمد بوخمادة", "MASTER", "FACULTY"],
    ["تركي عادل الساعدي", "BACHELOR_STUDENT", "STUDENT"],
    ["م. دانة صالح المنفي", "LECTURER", "FACULTY"],
  ];
  const researchers = [];
  for (const [i, [name, degree, type]] of people.entries()) {
    const d = depts[i % depts.length];
    const email = i === 0 ? "researcher@research.local" : `researcher${i + 1}@research.local`;
    const user = i < 3 ? await db.user.create({ data: { name, email, passwordHash: pass, roleId: researcherRole, departmentId: d.id, collegeId: d.collegeId } }) : null;
    researchers.push(
      await db.researcher.create({
        data: {
          fullName: name, universityId: `44${String(1000 + i * 37)}`, email, phone: `05${String(10000000 + i * 1234567).slice(0, 8)}`,
          type, academicDegree: degree, collegeId: d.collegeId, departmentId: d.id, userId: user?.id,
          specialization: pick(categories, i).name,
          generalSpecialization: d.name.replace("قسم ", ""),
          jobTitle: type === "FACULTY" ? "عضو هيئة تدريس" : "طالب",
          qualification: type === "FACULTY" ? (degree === "MASTER" || degree === "LECTURER" ? "ماجستير في " : "دكتوراه في ") + pick(categories, i).name : null,
          qualificationYear: type === "FACULTY" ? 2008 + (i % 12) : null,
          researchInterests: [pick(categories, i).name, pick(categories, i + 3).name],
          orcid: i % 3 !== 2 ? `0000-0002-${String(1000 + i * 111).slice(0, 4)}-${String(100 + i * 7).padStart(3, "0")}${i % 10}` : null,
          scopusId: i % 2 === 0 ? String(57200000000 + i * 1234567) : null,
          googleScholar: i % 3 === 0 ? `https://scholar.google.com/citations?user=DEMO${i}` : null,
        },
      }),
    );
  }

  // الأبحاث
  const titles: [string, string, string[]][] = [
    ["تقييم السلامة البديل للدوارات غير التقليدية في ظل ظروف المرور المختلط المزدحم", "Surrogate Safety Assessment of Unconventional Roundabouts Under Congested Mixed-Traffic Conditions", ["سلامة المرور", "الدوارات", "المحاكاة"]],
    ["دراسة خصائص الخرسانة المضاف إليها مخلفات البناء المعاد تدويرها", "Properties of Concrete with Recycled Construction Waste Aggregates", ["الخرسانة", "إعادة التدوير", "مواد البناء"]],
    ["تصميم منظومة طاقة شمسية هجينة لمباني المعهد", "Design of a Hybrid Solar Energy System for Institute Buildings", ["الطاقة الشمسية", "الأنظمة الهجينة"]],
    ["تحسين استقرار شبكات التوزيع الكهربائية باستخدام المكثفات الذكية", "Improving Distribution Network Stability Using Smart Capacitors", ["الشبكات الكهربائية", "جودة القدرة"]],
    ["نظام كشف التسلل في الشبكات باستخدام تعلم الآلة", "ML-based Network Intrusion Detection", ["أمن الشبكات", "تعلم الآلة", "كشف التسلل"]],
    ["تحليل أعطال المضخات الطاردة المركزية في محطات المياه", "Failure Analysis of Centrifugal Pumps in Water Stations", ["المضخات", "الصيانة التنبؤية"]],
    ["تقييم جودة المياه الجوفية في منطقة بنغازي", "Groundwater Quality Assessment in the Benghazi Region", ["المياه الجوفية", "البيئة"]],
    ["تطبيق الشبكات العصبية في التنبؤ بالأحمال الكهربائية", "Neural Networks for Electrical Load Forecasting", ["الذكاء الاصطناعي", "التنبؤ بالأحمال"]],
    ["كفاءة العزل الحراري في المباني السكنية بالمناخ الحار", "Thermal Insulation Efficiency in Residential Buildings in Hot Climates", ["العزل الحراري", "كفاءة الطاقة"]],
    ["تحسين خواص اللحام في سبائك الألمنيوم", "Improving Weld Properties of Aluminum Alloys", ["اللحام", "السبائك"]],
    ["تطبيقات إنترنت الأشياء في مراقبة خطوط نقل النفط", "IoT Applications for Oil Pipeline Monitoring", ["إنترنت الأشياء", "النفط والغاز"]],
    ["تحسين خوارزميات الجدولة في أنظمة الحوسبة السحابية", "Scheduling Optimization in Cloud Computing", ["الحوسبة السحابية", "الجدولة"]],
    ["قياس مستوى الوعي بالأمن السيبراني لدى طلاب المعهد", "Cybersecurity Awareness among Institute Students", ["الأمن السيبراني", "الوعي"]],
    ["معالجة مياه الصرف الصناعي باستخدام المرشحات الطبيعية", "Industrial Wastewater Treatment Using Natural Filters", ["معالجة المياه", "البيئة"]],
    ["نمذجة تدفق المرور في التقاطعات المحكومة بإشارات ضوئية", "Traffic Flow Modeling at Signalized Intersections", ["هندسة المرور", "النمذجة"]],
    ["تصميم روبوت تعليمي منخفض التكلفة لطلاب التقنيات الهندسية", "Low-Cost Educational Robot for Engineering Students", ["الروبوتات", "التعليم الهندسي"]],
  ];

  const statuses: ResearchStatus[] = [
    "PUBLISHED", "ACCEPTED", "UNDER_REVIEW", "NEEDS_REVISION", "SUBMITTED", "ADMIN_REVIEW", "REJECTED", "UNDER_REVIEW",
    "RESUBMITTED", "PUBLISHED", "DRAFT", "ACCEPTED", "SUBMITTED", "ARCHIVED", "UNDER_REVIEW", "PUBLISHED",
  ];
  const types: ResearchType[] = ["GRADUATION_PROJECT", "MASTER_THESIS", "JOURNAL_ARTICLE", "CONFERENCE_PAPER", "PHD_DISSERTATION", "FUNDED_PROJECT"];
  const levels: ResearchLevel[] = ["UNDERGRADUATE", "MASTER", "FACULTY", "FACULTY", "DOCTORATE", "FACULTY"];
  const catForTitle = [0, 1, 2, 3, 5, 6, 7, 4, 2, 6, 4, 4, 5, 7, 0, 4];
  const recs: ReviewRecommendation[] = ["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"];

  for (const [i, [titleAr, titleEn, keywords]] of titles.entries()) {
    const status = statuses[i];
    const r = researchers[i % researchers.length];
    const created = daysAgo(330 - i * 20);
    const year = created.getFullYear();
    const referenceNo = `RES-${year}-${String(i + 1).padStart(4, "0")}`;
    const submitted = status === "DRAFT" ? null : new Date(created.getTime() + 2 * 86400000);
    const decided = ["ACCEPTED", "REJECTED", "PUBLISHED", "ARCHIVED"].includes(status) ? new Date(created.getTime() + 40 * 86400000) : null;
    const paper = await db.researchPaper.create({
      data: {
        referenceNo, titleAr, titleEn, keywords,
        abstract: `[بيانات تجريبية] يتناول هذا البحث موضوع "${titleAr}"، ويهدف إلى دراسة المشكلة البحثية وتحليلها باستخدام منهجية علمية مناسبة، وعرض النتائج والتوصيات المستخلصة. هذا الملخص نص تجريبي لأغراض التطوير والاختبار فقط.`,
        mainResearcherId: r.id, collegeId: r.collegeId, departmentId: r.departmentId, categoryId: categories[catForTitle[i]].id,
        specialization: categories[catForTitle[i]].name,
        supervisorName: i % 3 === 0 ? "أ.د. عبدالله الحميد" : i % 3 === 1 ? "د. ليلى السديري" : null,
        type: pick(types, i), level: pick(levels, i), status,
        submittedAt: submitted, decidedAt: decided,
        decisionAccepted: decided ? status !== "REJECTED" : null,
        publishedAt: status === "PUBLISHED" || (status === "ARCHIVED") ? new Date(created.getTime() + 60 * 86400000) : null,
        archivedAt: status === "ARCHIVED" ? new Date(created.getTime() + 90 * 86400000) : null,
        publicationInfo: status === "PUBLISHED" ? "المجلد 12، العدد 3" : null,
        recordKind: ["PUBLISHED", "ARCHIVED"].includes(status) && i % 2 === 0 ? "PUBLISHED_RECORD" : "SUBMISSION",
        indexing: ["PUBLISHED", "ARCHIVED"].includes(status) ? (["SCOPUS", "SCOPUS_WOS", "WOS", "OTHER"] as const)[i % 4] : "NONE",
        doi: ["PUBLISHED", "ARCHIVED"].includes(status) ? `10.5555/demo.${2025}.${String(i + 1).padStart(4, "0")}` : null,
        publicationYear: ["PUBLISHED", "ARCHIVED"].includes(status) ? 2024 + (i % 3) : null,
        articleType: i % 5 === 0 ? "REVIEW" : "ORIGINAL",
        createdById: i < 3 ? (r.userId ?? staff.id) : staff.id,
        createdAt: created,
        authors: {
          create: [
            { name: r.fullName, researcherId: r.id, role: "MAIN", order: 0 },
            ...(i % 2 === 0 ? [{ name: researchers[(i + 3) % researchers.length].fullName, researcherId: researchers[(i + 3) % researchers.length].id, role: "CO_AUTHOR" as const, order: 1 }] : []),
          ],
        },
      },
    });
    const version = await db.researchVersion.create({ data: { paperId: paper.id, versionNo: 1, note: "النسخة الأولى", createdById: paper.createdById, createdAt: created } });
    const f = await storeDemoFile(await makePdf(titleEn, referenceNo), "pdf");
    await db.researchFile.create({
      data: {
        paperId: paper.id, versionId: version.id, category: "MAIN_DOCUMENT", title: "ملف البحث (تجريبي)", originalName: `${referenceNo}.pdf`,
        storageKey: f.storageKey, mimeType: "application/pdf", extension: "pdf", size: f.size, sha256: f.sha256,
        uploadedById: paper.createdById, uploadedAt: created,
      },
    });

    // سجل الحالات
    const path: ResearchStatus[] = ["DRAFT"];
    const flow: Record<string, ResearchStatus[]> = {
      SUBMITTED: ["SUBMITTED"], ADMIN_REVIEW: ["SUBMITTED", "ADMIN_REVIEW"], UNDER_REVIEW: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW"],
      NEEDS_REVISION: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "NEEDS_REVISION"],
      RESUBMITTED: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "NEEDS_REVISION", "RESUBMITTED"],
      ACCEPTED: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "ACCEPTED"], REJECTED: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "REJECTED"],
      PUBLISHED: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "ACCEPTED", "PUBLISHED"],
      ARCHIVED: ["SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "ACCEPTED", "PUBLISHED", "ARCHIVED"], DRAFT: [],
    };
    path.push(...flow[status]);
    for (let k = 0; k < path.length; k++) {
      await db.researchStatusHistory.create({
        data: { paperId: paper.id, fromStatus: k === 0 ? null : path[k - 1], toStatus: path[k], changedById: k < 2 ? paper.createdById : manager.id, createdAt: new Date(created.getTime() + k * 7 * 86400000) },
      });
    }

    // التحكيم
    if (path.includes("UNDER_REVIEW")) {
      const revs = [reviewers[i % reviewers.length], reviewers[(i + 1) % reviewers.length]];
      for (const [k, rv] of revs.entries()) {
        const done = !["UNDER_REVIEW"].includes(status) || k === 0;
        const assignedAt = new Date(created.getTime() + 14 * 86400000);
        const dueDate = status === "UNDER_REVIEW" && !done ? new Date(Date.now() + (k + 2) * 86400000) : new Date(assignedAt.getTime() + 14 * 86400000);
        const a = await db.reviewAssignment.create({
          data: {
            paperId: paper.id, reviewerId: rv.id, assignedById: manager.id, assignedAt, dueDate,
            status: done ? "SUBMITTED" : k === 1 && i % 2 ? "IN_PROGRESS" : "PENDING", completedAt: done ? new Date(assignedAt.getTime() + 10 * 86400000) : null,
          },
        });
        if (done) {
          const rec = status === "REJECTED" ? "REJECT" : status === "NEEDS_REVISION" || status === "RESUBMITTED" ? "MAJOR_REVISION" : pick(recs.slice(0, 2), i + k);
          const sc = rec === "REJECT" ? [4, 3, 5, 4, 3] : rec === "MAJOR_REVISION" ? [6, 5, 6, 6, 6] : [8, 9, 8, 9, 8];
          await db.researchReview.create({
            data: {
              assignmentId: a.id, qualityScore: sc[0], methodologyScore: sc[1], referencesScore: sc[2], resultsScore: sc[3], originalityScore: sc[4],
              overallScore: sc.reduce((s, x) => s + x, 0) / sc.length, recommendation: rec, isDraft: false, submittedAt: a.completedAt,
              commentsToAuthor: "[بيانات تجريبية] البحث جيد في مجمله، ويُقترح تحسين عرض الإطار النظري وتحديث بعض المراجع، وتوضيح حدود الدراسة.",
              confidentialComments: "[بيانات تجريبية] ملاحظة سرية لمكتب الأبحاث فقط.",
            },
          });
        }
      }
    }
    if (status === "NEEDS_REVISION" || status === "RESUBMITTED") {
      await db.researchComment.create({ data: { paperId: paper.id, authorId: manager.id, type: "REVISION_REQUEST", body: "[بيانات تجريبية] يرجى إجراء التعديلات الواردة في تقارير المحكمين وإعادة رفع النسخة المعدلة مع خطاب الرد." } });
    }
    if (status === "RESUBMITTED") {
      const v2 = await db.researchVersion.create({ data: { paperId: paper.id, versionNo: 2, note: "النسخة المعدلة بعد التحكيم", createdById: paper.createdById } });
      const f2 = await storeDemoFile(await makePdf(titleEn + " (revised)", referenceNo), "pdf");
      const old = await db.researchFile.findFirstOrThrow({ where: { paperId: paper.id, category: "MAIN_DOCUMENT" } });
      await db.researchFile.update({ where: { id: old.id }, data: { isCurrent: false } });
      await db.researchFile.create({
        data: { paperId: paper.id, versionId: v2.id, category: "REVISED_DOCUMENT", title: "النسخة المعدلة (تجريبي)", originalName: `${referenceNo}-v2.pdf`, storageKey: f2.storageKey, mimeType: "application/pdf", extension: "pdf", size: f2.size, sha256: f2.sha256, uploadedById: paper.createdById, replacesId: old.id },
      });
    }
  }

  // إشعارات وسجل عمليات تجريبية
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@research.local" } });
  for (const u of [admin, manager, staff]) {
    await db.notification.createMany({
      data: [
        { userId: u.id, type: "NEW_SUBMISSION", title: "تم تقديم بحث جديد", body: "[تجريبي] بحث جديد بانتظار المراجعة الإدارية", link: "/research?status=SUBMITTED" },
        { userId: u.id, type: "REVIEW_SUBMITTED", title: "تم تسليم تقييم تحكيم", body: "[تجريبي] قام أحد المحكمين بتسليم تقييمه", link: "/reviews" },
      ],
    });
  }
  await db.auditLog.create({ data: { userId: admin.id, action: "CREATE", entity: "System", summary: "تهيئة البيانات التجريبية لبيئة التطوير" } });
  await db.systemSetting.upsert({ where: { key: "demoData" }, create: { key: "demoData", value: true }, update: { value: true } });
}

/** بيانات تجريبية لوحدات الإنتاج العلمي (تُضاف أيضاً لقواعد البيانات التجريبية الموجودة سابقاً) */
async function seedDemoModules(db: Tx) {
  const pass = await bcrypt.hash("Password@123", 12);
  const role = async (k: string) => (await db.role.findUniqueOrThrow({ where: { key: k } })).id;
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@research.local" } });
  const researchers = await db.researcher.findMany({ orderBy: { createdAt: "asc" } });
  const depts = await db.department.findMany({ orderBy: { createdAt: "asc" } });
  if (researchers.length < 4 || depts.length === 0) return;
  const R = (i: number) => researchers[i % researchers.length];

  // المجلات العلمية
  const journalsData: [string, string, string, "SCOPUS" | "WOS" | "SCOPUS_WOS" | "OTHER" | "NONE", "Q1" | "Q2" | "Q3" | "Q4" | "NONE", string][] = [
    ["Journal of Transportation Safety & Security (تجريبي)", "Taylor & Francis", "1943-9962", "SCOPUS_WOS", "Q2", "هندسة النقل"],
    ["Construction and Building Materials (تجريبي)", "Elsevier", "0950-0618", "SCOPUS_WOS", "Q1", "مواد البناء"],
    ["Renewable Energy Journal (تجريبي)", "Elsevier", "0960-1481", "SCOPUS", "Q1", "الطاقة المتجددة"],
    ["المجلة الليبية للعلوم الهندسية (تجريبي)", "المعهد العالي للتقنيات الهندسية", "2789-1234", "NONE", "NONE", "العلوم الهندسية"],
    ["International Journal of Electrical Engineering (تجريبي)", "IEEE", "2167-0471", "WOS", "Q3", "الهندسة الكهربائية"],
  ];
  const journals = [];
  for (const [i, [name, publisher, issn, indexing, quartile, field]] of journalsData.entries()) {
    journals.push(await db.journal.upsert({
      where: { issn }, update: {},
      create: { name, publisher, issn, indexing, quartile, field, indexingVerified: i !== 4, verifiedAt: i !== 4 ? daysAgo(30 * i) : null, url: "https://example.org/journal" },
    }));
  }
  // ربط الأبحاث المنشورة بالمجلات وبيانات النشر
  const published = await db.researchPaper.findMany({ where: { OR: [{ status: "PUBLISHED" }, { status: "ARCHIVED" }] }, orderBy: { createdAt: "asc" } });
  for (const [i, p] of published.entries()) {
    const j = journals[i % journals.length];
    await db.researchPaper.update({
      where: { id: p.id },
      data: {
        journalId: p.journalId ?? j.id, indexing: p.indexing !== "NONE" ? p.indexing : j.indexing,
        doi: p.doi ?? `10.5555/demo.2025.${String(i + 1).padStart(4, "0")}`, publicationYear: p.publicationYear ?? 2024 + (i % 3),
        url: p.url ?? `https://doi.org/10.5555/demo.2025.${String(i + 1).padStart(4, "0")}`,
      },
    });
  }
  // استكمال المعرفات العلمية للباحثين القدامى إن لم تكن موجودة
  for (const [i, r] of researchers.entries()) {
    if (r.researchInterests.length) continue;
    await db.researcher.update({
      where: { id: r.id },
      data: {
        type: r.type === "STUDENT" && i % 3 === 0 ? "STUDENT" : "FACULTY", jobTitle: "عضو هيئة تدريس",
        researchInterests: [["هندسة الطرق", "الذكاء الاصطناعي", "الطاقة المتجددة", "المواد"][i % 4], ["السلامة المرورية", "أمن المعلومات", "الشبكات الكهربائية", "البيئة"][i % 4]],
        orcid: i % 3 !== 2 ? `0000-0003-${String(2000 + i * 97).slice(0, 4)}-${String(200 + i * 3).padStart(3, "0")}${i % 10}` : null,
        scopusId: i % 2 === 0 ? String(57300000000 + i * 7654321) : null,
        qualification: "ماجستير في الهندسة", qualificationYear: 2010 + (i % 10),
      },
    });
  }

  // المشاريع البحثية
  const projects: [string, "PROPOSAL" | "UNDER_REVIEW" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "PUBLISHED", "APPROVED" | "PENDING"][] = [
    ["تطوير نموذج ذكي لإدارة الإشارات الضوئية في مدينة بنغازي", "IN_PROGRESS", "APPROVED"],
    ["إنتاج طوب بيئي من مخلفات البناء المحلية", "COMPLETED", "APPROVED"],
    ["محطة شمسية تجريبية لتغذية مختبرات المعهد", "APPROVED", "APPROVED"],
    ["منصة إلكترونية لمتابعة صيانة معدات الورش", "PROPOSAL", "PENDING"],
    ["دراسة استهلاك الطاقة في المباني الحكومية", "PUBLISHED", "APPROVED"],
  ];
  for (const [i, [title, status, approval]] of projects.entries()) {
    const lead = R(i);
    const p = await db.researchProject.create({
      data: {
        title: `${title} (تجريبي)`, leadId: lead.id, departmentId: lead.departmentId, status, approval,
        objectives: "[بيانات تجريبية] تطوير حل عملي للمشكلة البحثية وتوثيق النتائج ونشرها.",
        summary: "[بيانات تجريبية] مشروع بحثي تطبيقي ينفذه فريق من أعضاء هيئة التدريس بالمعهد.",
        startDate: daysAgo(300 - i * 40), expectedEndDate: new Date(Date.now() + (200 - i * 30) * 86400000),
        expectedOutputs: "ورقة علمية منشورة، نموذج أولي، تقرير فني", actualOutputs: status === "COMPLETED" || status === "PUBLISHED" ? "تم نشر ورقة علمية وتسليم التقرير الفني" : null,
        partners: i % 2 === 0 ? "بلدية بنغازي (تجريبي)" : "الشركة العامة للكهرباء (تجريبي)", reportEveryMonths: i % 2 === 0 ? 3 : 6,
        nextReportDue: new Date(Date.now() + (i + 1) * 86400000 * 10), createdById: lead.userId ?? admin.id,
        members: { create: [{ researcherId: R(i + 1).id, name: R(i + 1).fullName, role: "عضو فريق" }, { researcherId: null, name: "م. أحمد الشاعري (من خارج المعهد)", role: "عضو من خارج المعهد" }] },
        reports: status === "IN_PROGRESS" || status === "COMPLETED" ? { create: [{ period: "الربع الأول 2026", progress: status === "COMPLETED" ? 100 : 45, body: "[بيانات تجريبية] تم إنجاز جمع البيانات والتصميم الأولي.", createdById: lead.userId ?? admin.id }] } : undefined,
      },
    });
    void p;
  }

  // المشاركات في المؤتمرات والفعاليات
  const events: [string, "CONFERENCE" | "SEMINAR" | "WORKSHOP" | "TRAINING", "LOCAL" | "INTERNATIONAL", string, "PRESENTER" | "ATTENDANCE" | "SESSION_CHAIR", "APPROVED" | "PENDING"][] = [
    ["المؤتمر الدولي للهندسة المدنية والبنية التحتية", "CONFERENCE", "INTERNATIONAL", "جامعة القاهرة", "PRESENTER", "APPROVED"],
    ["المؤتمر الليبي للطاقة المتجددة", "CONFERENCE", "LOCAL", "جامعة بنغازي", "PRESENTER", "APPROVED"],
    ["ندوة التحول الرقمي في التعليم التقني", "SEMINAR", "LOCAL", "الهيئة الوطنية للتعليم التقني", "ATTENDANCE", "APPROVED"],
    ["ورشة النشر في المجلات المحكمة", "WORKSHOP", "INTERNATIONAL", "Elsevier", "ATTENDANCE", "APPROVED"],
    ["المؤتمر العربي للذكاء الاصطناعي", "CONFERENCE", "INTERNATIONAL", "جامعة تونس", "SESSION_CHAIR", "PENDING"],
  ];
  for (const [i, [name, type, scope, organizer, roleP, approval]] of events.entries()) {
    await db.scientificEvent.create({
      data: {
        name: `${name} (تجريبي)`, type, scope, organizer, location: scope === "INTERNATIONAL" ? "خارج ليبيا" : "بنغازي",
        startDate: daysAgo(250 - i * 45), approval, createdById: R(i).userId ?? admin.id, url: "https://example.org/event",
        participants: { create: [{ researcherId: R(i).id, role: roleP, paperTitle: roleP === "PRESENTER" ? "ورقة علمية تجريبية" : null }, ...(i % 2 === 0 ? [{ researcherId: R(i + 2).id, role: "ATTENDANCE" as const }] : [])] },
      },
    });
  }
  // الأنشطة التي ينظمها المعهد
  const acts: [string, "CONFERENCE" | "SEMINAR" | "WORKSHOP" | "TRAINING" | "LECTURE" | "SCIENTIFIC_DAY", number][] = [
    ["ندوة النشر في المجلات المصنفة", "SEMINAR", 85],
    ["ورشة عمل استخدام برنامج SPSS", "WORKSHOP", 40],
    ["ورشة الذكاء الاصطناعي في البحث العلمي", "WORKSHOP", 60],
    ["دورة كتابة المقترحات البحثية", "TRAINING", 30],
    ["محاضرة أخلاقيات البحث العلمي", "LECTURE", 120],
    ["اليوم العلمي الأول للمعهد", "SCIENTIFIC_DAY", 250],
  ];
  for (const [i, [name, type, n]] of acts.entries()) {
    await db.scientificEvent.create({
      data: {
        name: `${name} (تجريبي)`, type, scope: "LOCAL", organizedByInstitute: true, organizer: "مكتب البحث العلمي", location: "قاعة المعهد",
        startDate: i === 5 ? new Date(Date.now() + 20 * 86400000) : daysAgo(200 - i * 30), attendeesCount: n, approval: "APPROVED", createdById: admin.id,
        participants: { create: [{ researcherId: R(i + 3).id, role: "ORGANIZER" }] },
      },
    });
  }
  // التعاون البحثي
  await db.collaboration.createMany({
    data: [
      { partnerName: "جامعة بنغازي (تجريبي)", partnerType: "LIBYAN_UNIVERSITY", type: "MOU", title: "مذكرة تفاهم للتعاون في البحث العلمي وتبادل الخبرات", startDate: daysAgo(400), endDate: new Date(Date.now() + 700 * 86400000), coordinator: "د. خالد العبيدي", createdById: admin.id },
      { partnerName: "مركز البحوث الصناعية (تجريبي)", partnerType: "RESEARCH_CENTER", type: "JOINT_PROJECT", title: "مشروع مشترك لاختبار مواد البناء المحلية", startDate: daysAgo(200), createdById: admin.id },
      { partnerName: "جامعة مالطا (تجريبي)", partnerType: "INTERNATIONAL_UNIVERSITY", type: "AGREEMENT", title: "اتفاقية تعاون أكاديمي وبحثي", startDate: daysAgo(900), endDate: daysAgo(100), createdById: admin.id },
      { partnerName: "الشركة العامة للكهرباء (تجريبي)", partnerType: "GOVERNMENT", type: "JOINT_RESEARCH", title: "بحث مشترك حول فاقد الطاقة في شبكات التوزيع", startDate: daysAgo(150), createdById: admin.id },
    ],
  });
  // الجوائز
  const awards: [string, "BEST_PAPER" | "INNOVATION" | "PATENT" | "EXCELLENCE", string, "APPROVED" | "PENDING"][] = [
    ["جائزة أفضل بحث في المؤتمر الليبي للطاقة المتجددة", "BEST_PAPER", "جامعة بنغازي", "APPROVED"],
    ["جائزة الابتكار التقني", "INNOVATION", "وزارة التعليم التقني", "APPROVED"],
    ["براءة اختراع: جهاز لقياس رطوبة التربة", "PATENT", "مكتب براءات الاختراع", "APPROVED"],
    ["شهادة التميز البحثي لعام 2025", "EXCELLENCE", "المعهد العالي للتقنيات الهندسية", "PENDING"],
  ];
  for (const [i, [title, type, grantor, approval]] of awards.entries()) {
    await db.award.create({ data: { researcherId: R(i).id, title: `${title} (تجريبي)`, type, grantor, date: daysAgo(100 + i * 60), approval, createdById: R(i).userId ?? admin.id } });
  }
  // رئيس قسم وطالب
  const head = await db.user.upsert({
    where: { email: "depthead@research.local" }, update: {},
    create: { name: "د. سالم المقصبي", email: "depthead@research.local", passwordHash: pass, roleId: await role("DEPT_HEAD"), departmentId: depts[0].id, collegeId: depts[0].collegeId },
  });
  if (!(await db.researcher.findUnique({ where: { email: "depthead@research.local" } }))) {
    await db.researcher.create({
      data: { fullName: "د. سالم المقصبي", universityId: "HIET-0001", email: "depthead@research.local", type: "FACULTY", academicDegree: "ASSOCIATE_PROFESSOR",
        departmentId: depts[0].id, collegeId: depts[0].collegeId, userId: head.id, jobTitle: "رئيس قسم", researchInterests: ["هندسة الطرق", "السلامة المرورية"], orcid: "0000-0001-5000-0001" },
    });
  }
  await db.user.upsert({
    where: { email: "student@research.local" }, update: {},
    create: { name: "الطالب أحمد الفرجاني", email: "student@research.local", passwordHash: pass, roleId: await role("STUDENT") },
  });
}


async function main() {
  await seedBase();
  if (!BASE_ONLY) await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
