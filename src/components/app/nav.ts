import type { PermissionCode } from "@/lib/constants";

export type NavItem = { href: string; label: string; icon: string; perms?: PermissionCode[]; section: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "LayoutDashboard", section: "الرئيسية" },
  { href: "/notifications", label: "الإشعارات", icon: "Bell", section: "الرئيسية" },
  { href: "/research", label: "إدارة الأبحاث", icon: "FileText", perms: ["research.view_all", "research.create"], section: "الأبحاث" },
  { href: "/research/new", label: "إضافة بحث جديد", icon: "FilePlus2", perms: ["research.create"], section: "الأبحاث" },
  { href: "/reviews", label: "التحكيم العلمي", icon: "ClipboardCheck", perms: ["reviews.perform", "reviews.assign", "reviews.view_all"], section: "الأبحاث" },
  { href: "/archive", label: "الأرشيف العلمي", icon: "Archive", perms: ["archive.view"], section: "الأبحاث" },
  { href: "/researchers", label: "الباحثون والطلاب", icon: "GraduationCap", perms: ["researchers.view"], section: "الأشخاص" },
  { href: "/reviewers", label: "المحكمون", icon: "UserCheck", perms: ["reviewers.manage"], section: "الأشخاص" },
  { href: "/structure", label: "الكليات والأقسام", icon: "Building2", perms: ["structure.manage"], section: "الإدارة" },
  { href: "/reports", label: "التقارير والإحصائيات", icon: "BarChart3", perms: ["reports.view"], section: "الإدارة" },
  { href: "/users", label: "إدارة المستخدمين", icon: "Users", perms: ["users.manage"], section: "الإدارة" },
  { href: "/roles", label: "الأدوار والصلاحيات", icon: "KeyRound", perms: ["roles.manage"], section: "الإدارة" },
  { href: "/audit", label: "سجل العمليات", icon: "History", perms: ["audit.view"], section: "الإدارة" },
  { href: "/settings", label: "إعدادات النظام", icon: "Settings", perms: ["settings.manage"], section: "الإدارة" },
  { href: "/profile", label: "الملف الشخصي", icon: "UserCircle", section: "الحساب" },
];
