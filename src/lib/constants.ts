// ثوابت النظام والتسميات العربية — يمكن استيرادها في الخادم والمتصفح
import type {
  AcademicDegree,
  AssignmentStatus,
  CommentType,
  FileCategory,
  ResearchLevel,
  ResearchStatus,
  ResearchType,
  ResearcherType,
  ReviewRecommendation,
} from "@/generated/prisma/enums";

/** نص العلامة المائية — يجب أن يبقى حرفياً كما هو */
export const WATERMARK_TEXT = "عمل الطالبة رهف إبراهيم والطالبة أسيل خالد";

export const APP_NAME = "نظام إدارة مكتب الأبحاث العلمية";
export const APP_NAME_EN = "Scientific Research Office Management System";

export const ROLE_KEYS = {
  ADMIN: "ADMIN",
  OFFICE_MANAGER: "OFFICE_MANAGER",
  STAFF: "STAFF",
  RESEARCHER: "RESEARCHER",
  REVIEWER: "REVIEWER",
} as const;
export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  OFFICE_MANAGER: "مدير مكتب الأبحاث العلمية",
  STAFF: "موظف إداري",
  RESEARCHER: "باحث",
  REVIEWER: "محكم علمي",
};

/** قائمة الصلاحيات المعتمدة في النظام */
export const PERMISSIONS = [
  { code: "dashboard.view", name: "عرض لوحة التحكم الإدارية", group: "عام" },
  { code: "research.view_all", name: "عرض جميع الأبحاث", group: "الأبحاث" },
  { code: "research.create", name: "إنشاء / تسجيل بحث", group: "الأبحاث" },
  { code: "research.edit_all", name: "تعديل بيانات أي بحث", group: "الأبحاث" },
  { code: "research.delete", name: "حذف الأبحاث", group: "الأبحاث" },
  { code: "research.change_status", name: "تغيير حالة البحث (مراجعة إدارية)", group: "الأبحاث" },
  { code: "research.approve", name: "اعتماد القرار النهائي (قبول/رفض/نشر)", group: "الأبحاث" },
  { code: "research.comment", name: "إضافة الملاحظات وطلب التعديلات", group: "الأبحاث" },
  { code: "files.manage", name: "إدارة ملفات الأبحاث", group: "الملفات" },
  { code: "reviews.assign", name: "تعيين المحكمين", group: "التحكيم" },
  { code: "reviews.view_all", name: "الاطلاع على تقييمات المحكمين", group: "التحكيم" },
  { code: "reviews.perform", name: "تنفيذ التحكيم العلمي", group: "التحكيم" },
  { code: "researchers.view", name: "عرض الباحثين", group: "الباحثون" },
  { code: "researchers.manage", name: "إدارة الباحثين", group: "الباحثون" },
  { code: "reviewers.manage", name: "إدارة المحكمين", group: "التحكيم" },
  { code: "structure.manage", name: "إدارة الكليات والأقسام والتخصصات", group: "الهيكل الأكاديمي" },
  { code: "archive.view", name: "الاطلاع على الأرشيف العلمي", group: "الأرشيف" },
  { code: "reports.view", name: "عرض وتصدير التقارير", group: "التقارير" },
  { code: "users.manage", name: "إدارة المستخدمين", group: "الإدارة" },
  { code: "roles.manage", name: "إدارة الأدوار والصلاحيات", group: "الإدارة" },
  { code: "audit.view", name: "عرض سجل العمليات", group: "الإدارة" },
  { code: "settings.manage", name: "إدارة إعدادات النظام والنسخ الاحتياطي", group: "الإدارة" },
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** الصلاحيات الافتراضية لكل دور (تُطبّق عند التهيئة ويمكن تعديلها من الواجهة) */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionCode[]> = {
  ADMIN: PERMISSIONS.map((p) => p.code),
  OFFICE_MANAGER: [
    "dashboard.view", "research.view_all", "research.create", "research.edit_all", "research.delete",
    "research.change_status", "research.approve", "research.comment", "files.manage",
    "reviews.assign", "reviews.view_all", "researchers.view", "researchers.manage", "reviewers.manage",
    "structure.manage", "archive.view", "reports.view", "audit.view",
  ],
  STAFF: [
    "dashboard.view", "research.view_all", "research.create", "research.edit_all",
    "research.change_status", "research.comment", "files.manage", "researchers.view",
    "researchers.manage", "archive.view", "reports.view",
  ],
  RESEARCHER: ["research.create", "archive.view"],
  REVIEWER: ["reviews.perform"],
};

export const STATUS_LABELS: Record<ResearchStatus, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "تم التقديم",
  ADMIN_REVIEW: "قيد المراجعة الإدارية",
  UNDER_REVIEW: "قيد التحكيم العلمي",
  NEEDS_REVISION: "يحتاج إلى تعديلات",
  RESUBMITTED: "تمت إعادة التقديم",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  PUBLISHED: "منشور",
  ARCHIVED: "مؤرشف",
};

export const STATUS_COLORS: Record<ResearchStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-sky-50 text-sky-700 border-sky-200",
  ADMIN_REVIEW: "bg-indigo-50 text-indigo-700 border-indigo-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  NEEDS_REVISION: "bg-amber-50 text-amber-800 border-amber-200",
  RESUBMITTED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  PUBLISHED: "bg-teal-50 text-teal-700 border-teal-200",
  ARCHIVED: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const STATUS_ORDER: ResearchStatus[] = [
  "DRAFT", "SUBMITTED", "ADMIN_REVIEW", "UNDER_REVIEW", "NEEDS_REVISION",
  "RESUBMITTED", "ACCEPTED", "REJECTED", "PUBLISHED", "ARCHIVED",
];

export const TYPE_LABELS: Record<ResearchType, string> = {
  GRADUATION_PROJECT: "مشروع تخرج",
  MASTER_THESIS: "رسالة ماجستير",
  PHD_DISSERTATION: "أطروحة دكتوراه",
  JOURNAL_ARTICLE: "بحث محكم للنشر",
  CONFERENCE_PAPER: "ورقة مؤتمر علمي",
  FUNDED_PROJECT: "مشروع بحثي ممول",
  OTHER: "أخرى",
};

export const LEVEL_LABELS: Record<ResearchLevel, string> = {
  UNDERGRADUATE: "بكالوريوس",
  DIPLOMA: "دبلوم عالٍ",
  MASTER: "ماجستير",
  DOCTORATE: "دكتوراه",
  FACULTY: "أعضاء هيئة التدريس",
};

export const DEGREE_LABELS: Record<AcademicDegree, string> = {
  BACHELOR_STUDENT: "طالب بكالوريوس",
  BACHELOR: "بكالوريوس",
  MASTER_STUDENT: "طالب ماجستير",
  MASTER: "ماجستير",
  PHD_STUDENT: "طالب دكتوراه",
  PHD: "دكتوراه",
  LECTURER: "محاضر",
  ASSISTANT_PROFESSOR: "أستاذ مساعد",
  ASSOCIATE_PROFESSOR: "أستاذ مشارك",
  PROFESSOR: "أستاذ دكتور",
};

export const RESEARCHER_TYPE_LABELS: Record<ResearcherType, string> = {
  STUDENT: "طالب",
  FACULTY: "عضو هيئة تدريس",
  STAFF: "موظف",
  EXTERNAL: "باحث خارجي",
};

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  MAIN_DOCUMENT: "ملف البحث الرئيسي",
  REVISED_DOCUMENT: "نسخة معدلة",
  ATTACHMENT: "مرفق",
  DATA: "بيانات",
  PRESENTATION: "عرض تقديمي",
  IMAGE: "صورة",
  REVIEW_REPORT: "تقرير محكم",
  OTHER: "أخرى",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PENDING: "بانتظار التحكيم",
  IN_PROGRESS: "قيد التحكيم",
  SUBMITTED: "تم تسليم التقييم",
  DECLINED: "اعتذر المحكم",
  CANCELLED: "ملغى",
};

export const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  SUBMITTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DECLINED: "bg-rose-50 text-rose-700 border-rose-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  ACCEPT: "قبول",
  MINOR_REVISION: "قبول بعد تعديلات بسيطة",
  MAJOR_REVISION: "قبول بعد تعديلات جوهرية",
  REJECT: "رفض",
};

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  NOTE: "ملاحظة",
  REVISION_REQUEST: "طلب تعديل",
  RESEARCHER_REPLY: "رد الباحث",
  DECISION: "قرار",
  INTERNAL: "ملاحظة داخلية",
};

/** امتدادات وأنواع الملفات المسموح بها */
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  doc: ["application/msword", "application/x-cfb"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
};
export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES);
export const FILE_ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => "." + e).join(",");
