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
  for (const key of Object.keys(DEFAULT_ROLE_PERMISSIONS) as RoleKey[]) {
    const role = await db.role.upsert({
      where: { key },
      create: { key, name: ROLE_LABELS[key], isSystem: true },
      update: { name: ROLE_LABELS[key] },
    });
    const existing = await db.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0 || key === "ADMIN") {
      await db.rolePermission.deleteMany({ where: { roleId: role.id } });
      await db.rolePermission.createMany({
        data: DEFAULT_ROLE_PERMISSIONS[key].map((c) => ({ roleId: role.id, permissionId: byCode.get(c)! })),
      });
    }
  }
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
  if (process.env.NODE_ENV === "production") {
    console.log("⚠ تم تجاهل البيانات التجريبية في بيئة الإنتاج");
    return;
  }
  if ((await db.researchPaper.count()) > 0 || (await db.college.count()) > 0) {
    console.log("ℹ توجد بيانات مسبقاً — تم تخطي البيانات التجريبية");
    return;
  }
  // تنفيذ كامل البيانات التجريبية في معاملة واحدة (إما تنجح كلها أو لا شيء)
  await client.$transaction((tx) => seedDemoData(tx), { timeout: 300_000, maxWait: 20_000 });
  console.log("✔ تم إنشاء البيانات التجريبية (بيئة التطوير)");
}

async function seedDemoData(db: Tx) {
  const pass = await bcrypt.hash("Password@123", 12);
  const role = async (k: string) => (await db.role.findUniqueOrThrow({ where: { key: k } })).id;

  // الهيكل الأكاديمي
  const structure: Record<string, string[]> = {
    "كلية الهندسة وتقنية المعلومات": ["قسم علوم الحاسب", "قسم نظم المعلومات", "قسم الهندسة الكهربائية"],
    "كلية العلوم": ["قسم الكيمياء", "قسم الفيزياء", "قسم الأحياء"],
    "كلية العلوم الإدارية": ["قسم إدارة الأعمال", "قسم المحاسبة"],
    "كلية التربية": ["قسم المناهج وطرق التدريس", "قسم علم النفس"],
  };
  const depts: { id: string; collegeId: string; name: string }[] = [];
  let ci = 1;
  for (const [college, dlist] of Object.entries(structure)) {
    const c = await db.college.create({ data: { name: college, code: `C${ci++}` } });
    for (const d of dlist) depts.push(await db.department.create({ data: { name: d, collegeId: c.id } }));
  }
  const categories = await Promise.all(
    ["الذكاء الاصطناعي", "أمن المعلومات", "الطاقة المتجددة", "الكيمياء التحليلية", "التقنية الحيوية", "الإدارة والاقتصاد", "التعليم والتعلم", "علوم البيانات"].map(
      (name) => db.researchCategory.create({ data: { name } }),
    ),
  );

  // المستخدمون الأساسيون
  const manager = await db.user.create({ data: { name: "د. خالد العمري", email: "manager@research.local", passwordHash: pass, roleId: await role("OFFICE_MANAGER"), phone: "0500000001" } });
  const staff = await db.user.create({ data: { name: "سارة المطيري", email: "staff@research.local", passwordHash: pass, roleId: await role("STAFF"), phone: "0500000002" } });
  const reviewerRole = await role("REVIEWER");
  const reviewersData = [
    ["أ.د. محمد الزهراني", "reviewer@research.local", "أستاذ دكتور", "الذكاء الاصطناعي"],
    ["د. نورة القحطاني", "reviewer2@research.local", "أستاذ مشارك", "الكيمياء التحليلية"],
    ["د. فهد الشهري", "reviewer3@research.local", "أستاذ مساعد", "الإدارة والاقتصاد"],
    ["د. منى الحربي", "reviewer4@research.local", "أستاذ مشارك", "التعليم والتعلم"],
  ];
  const reviewers = [];
  for (const [i, [name, email, title, spec]] of reviewersData.entries()) {
    reviewers.push(
      await db.user.create({
        data: { name, email, passwordHash: pass, roleId: reviewerRole, academicTitle: title, specialization: spec, institution: "الجامعة", departmentId: depts[i * 2].id, collegeId: depts[i * 2].collegeId },
      }),
    );
  }

  // الباحثون
  const researcherRole = await role("RESEARCHER");
  const people: [string, AcademicDegree, "STUDENT" | "FACULTY"][] = [
    ["ريم عبدالله السالم", "BACHELOR_STUDENT", "STUDENT"],
    ["عبدالرحمن ناصر الدوسري", "MASTER_STUDENT", "STUDENT"],
    ["لمى سعد الغامدي", "BACHELOR_STUDENT", "STUDENT"],
    ["د. هند علي الشمري", "ASSISTANT_PROFESSOR", "FACULTY"],
    ["يوسف إبراهيم العتيبي", "PHD_STUDENT", "STUDENT"],
    ["جود فيصل المالكي", "BACHELOR_STUDENT", "STUDENT"],
    ["د. عمر حسن البقمي", "ASSOCIATE_PROFESSOR", "FACULTY"],
    ["شهد محمد الرشيدي", "MASTER_STUDENT", "STUDENT"],
    ["تركي عادل السبيعي", "BACHELOR_STUDENT", "STUDENT"],
    ["دانة صالح الجهني", "MASTER_STUDENT", "STUDENT"],
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
        },
      }),
    );
  }

  // الأبحاث
  const titles: [string, string, string[]][] = [
    ["استخدام تقنيات التعلم العميق في تشخيص أمراض الصدر من صور الأشعة", "Deep Learning for Chest X-Ray Diagnosis", ["التعلم العميق", "التشخيص الطبي", "الشبكات العصبية"]],
    ["أثر التحول الرقمي على أداء المنشآت الصغيرة والمتوسطة", "Impact of Digital Transformation on SMEs", ["التحول الرقمي", "المنشآت الصغيرة", "الأداء"]],
    ["تحليل جودة المياه الجوفية في المنطقة باستخدام الطرق الطيفية", "Spectroscopic Analysis of Groundwater Quality", ["المياه الجوفية", "التحليل الطيفي"]],
    ["نظام كشف التسلل في الشبكات باستخدام تعلم الآلة", "ML-based Network Intrusion Detection", ["أمن الشبكات", "تعلم الآلة", "كشف التسلل"]],
    ["فاعلية التعلم المدمج في تنمية مهارات التفكير الناقد", "Blended Learning and Critical Thinking", ["التعلم المدمج", "التفكير الناقد"]],
    ["تصميم منظومة طاقة شمسية هجينة للمباني الجامعية", "Hybrid Solar Energy System for Campus Buildings", ["الطاقة الشمسية", "الكفاءة"]],
    ["دراسة الخصائص المضادة للبكتيريا لمستخلصات نباتية محلية", "Antibacterial Properties of Local Plant Extracts", ["مضادات البكتيريا", "المستخلصات النباتية"]],
    ["تحليل المشاعر في التغريدات العربية باستخدام النماذج اللغوية", "Arabic Tweet Sentiment Analysis with Language Models", ["معالجة اللغة", "تحليل المشاعر"]],
    ["العوامل المؤثرة في جودة التقارير المالية", "Determinants of Financial Reporting Quality", ["المحاسبة", "التقارير المالية"]],
    ["أثر بيئة العمل على الرضا الوظيفي لدى المعلمين", "Work Environment and Teachers' Job Satisfaction", ["الرضا الوظيفي", "بيئة العمل"]],
    ["تطبيقات إنترنت الأشياء في الزراعة الذكية", "IoT Applications in Smart Agriculture", ["إنترنت الأشياء", "الزراعة الذكية"]],
    ["تحسين خوارزميات الجدولة في أنظمة الحوسبة السحابية", "Scheduling Optimization in Cloud Computing", ["الحوسبة السحابية", "الجدولة"]],
    ["قياس مستوى الوعي بالأمن السيبراني لدى طلاب الجامعة", "Cybersecurity Awareness among University Students", ["الأمن السيبراني", "الوعي"]],
    ["تحضير وتوصيف مواد نانوية لتنقية المياه", "Nanomaterials for Water Purification", ["المواد النانوية", "تنقية المياه"]],
    ["دور القيادة التحويلية في إدارة التغيير المؤسسي", "Transformational Leadership in Change Management", ["القيادة التحويلية", "إدارة التغيير"]],
    ["تصميم تطبيق تعليمي تفاعلي لتعليم الرياضيات للأطفال", "Interactive Math Learning App for Children", ["التعليم الإلكتروني", "الرياضيات"]],
  ];
  const statuses: ResearchStatus[] = [
    "PUBLISHED", "ACCEPTED", "UNDER_REVIEW", "NEEDS_REVISION", "SUBMITTED", "ADMIN_REVIEW", "REJECTED", "UNDER_REVIEW",
    "RESUBMITTED", "PUBLISHED", "DRAFT", "ACCEPTED", "SUBMITTED", "ARCHIVED", "UNDER_REVIEW", "PUBLISHED",
  ];
  const types: ResearchType[] = ["GRADUATION_PROJECT", "MASTER_THESIS", "JOURNAL_ARTICLE", "CONFERENCE_PAPER", "PHD_DISSERTATION", "FUNDED_PROJECT"];
  const levels: ResearchLevel[] = ["UNDERGRADUATE", "MASTER", "FACULTY", "FACULTY", "DOCTORATE", "FACULTY"];
  const catForTitle = [0, 5, 3, 1, 6, 2, 4, 0, 5, 6, 7, 7, 1, 3, 5, 6];
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
        publicationInfo: status === "PUBLISHED" ? "مجلة الجامعة للعلوم التطبيقية — المجلد 12، العدد 3" : null,
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
