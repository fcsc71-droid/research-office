import type { PermissionCode } from "@/lib/constants";

export type NavItem = { href: string; label: string; icon: string; perms?: PermissionCode[]; section: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "LayoutDashboard", section: "الرئيسية" },
  { href: "/notifications", label: "الإشعارات", icon: "Bell", section: "الرئيسية" },
  { href: "/my-records", label: "إنتاجي العلمي", icon: "Sparkles", perms: ["records.submit_own"], section: "الرئيسية" },
  { href: "/research", label: "البحوث والمنشورات", icon: "FileText", perms: ["research.view_all", "research.create", "research.view_department"], section: "البحث العلمي" },
  { href: "/research/new", label: "إضافة بحث", icon: "FilePlus2", perms: ["research.create"], section: "البحث العلمي" },
  { href: "/projects", label: "المشاريع البحثية", icon: "FolderKanban", perms: ["projects.manage", "records.approve", "records.submit_own", "research.view_department"], section: "البحث العلمي" },
  { href: "/reviews", label: "التحكيم العلمي", icon: "ClipboardCheck", perms: ["reviews.perform", "reviews.assign", "reviews.view_all"], section: "البحث العلمي" },
  { href: "/journals", label: "المجلات والنشر العلمي", icon: "Library", perms: ["journals.manage", "research.create", "research.view_all"], section: "البحث العلمي" },
  { href: "/archive", label: "الأرشيف العلمي", icon: "Archive", perms: ["archive.view"], section: "البحث العلمي" },
  { href: "/events", label: "المؤتمرات والندوات والورش", icon: "Presentation", perms: ["events.manage", "records.approve", "records.submit_own", "research.view_department"], section: "الأنشطة" },
  { href: "/activities", label: "أنشطة المعهد العلمية", icon: "CalendarDays", section: "الأنشطة" },
  { href: "/collaborations", label: "التعاون البحثي", icon: "Handshake", perms: ["collaborations.manage", "departments.profile"], section: "الأنشطة" },
  { href: "/awards", label: "الجوائز والتكريم", icon: "Award", perms: ["awards.manage", "records.approve", "records.submit_own", "research.view_department"], section: "الأنشطة" },
  { href: "/researchers", label: "أعضاء هيئة التدريس والباحثون", icon: "GraduationCap", perms: ["researchers.view"], section: "الأشخاص والأقسام" },
  { href: "/reviewers", label: "المحكمون", icon: "UserCheck", perms: ["reviewers.manage"], section: "الأشخاص والأقسام" },
  { href: "/departments", label: "الملفات البحثية للأقسام", icon: "Building", perms: ["departments.profile"], section: "الأشخاص والأقسام" },
  { href: "/import", label: "استيراد البيانات من Excel", icon: "FileSpreadsheet", perms: ["researchers.manage", "research.edit_all"], section: "الإدارة" },
  { href: "/structure", label: "الكليات والأقسام", icon: "Building2", perms: ["structure.manage"], section: "الأشخاص والأقسام" },
  { href: "/reports", label: "التقارير والإحصائيات", icon: "BarChart3", perms: ["reports.view"], section: "الإدارة" },
  { href: "/users", label: "إدارة المستخدمين", icon: "Users", perms: ["users.manage"], section: "الإدارة" },
  { href: "/roles", label: "الأدوار والصلاحيات", icon: "KeyRound", perms: ["roles.manage"], section: "الإدارة" },
  { href: "/audit", label: "سجل العمليات", icon: "History", perms: ["audit.view"], section: "الإدارة" },
  { href: "/settings", label: "إعدادات النظام", icon: "Settings", perms: ["settings.manage"], section: "الإدارة" },
  { href: "/profile", label: "الملف الشخصي", icon: "UserCircle", section: "الحساب" },
];
