import { randomInt } from "node:crypto";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getCurrentUser, can, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fileResponse, jsonError, sameOrigin } from "@/lib/http";
import { INSTITUTE_NAME, WATERMARK_TEXT, DEGREE_LABELS } from "@/lib/constants";

/** كلمة مرور مؤقتة سهلة القراءة تحقق سياسة كلمات المرور (حروف وأرقام) */
function tempPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += letters[randomInt(letters.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += digits[randomInt(digits.length)];
  return s;
}

/**
 * إنشاء حسابات دخول دفعة واحدة لأعضاء هيئة التدريس الذين ليس لديهم حساب.
 * يعيد ملف Excel بأسماء الدخول وكلمات المرور المؤقتة (تُعرض مرة واحدة فقط ولا تُخزَّن إلا مشفرة).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("غير مصرح", 401);
  if (!can(user, "researchers.manage")) return jsonError("ليست لديك صلاحية", 403);
  if (!sameOrigin(req)) return jsonError("طلب غير صالح", 403);
  const fd = await req.formData();
  const departmentId = String(fd.get("departmentId") ?? "") || undefined;
  const includeStudents = fd.get("includeStudents") === "on";

  const role = await db.role.findUniqueOrThrow({ where: { key: "RESEARCHER" } });
  const candidates = await db.researcher.findMany({
    where: { userId: null, ...(departmentId ? { departmentId } : {}), ...(includeStudents ? {} : { type: { not: "STUDENT" } }) },
    include: { department: { select: { name: true } } },
    orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
  });

  const rows: (string | number)[][] = [];
  let created = 0;
  for (const r of candidates) {
    const email = r.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      rows.push([r.fullName, r.universityId, r.department?.name ?? "—", email, "—", "تم التجاوز: يوجد مستخدم بنفس البريد الإلكتروني"]);
      continue;
    }
    const pass = tempPassword();
    const u = await db.user.create({
      data: {
        name: r.fullName, email, phone: r.phone, roleId: role.id, collegeId: r.collegeId, departmentId: r.departmentId,
        passwordHash: await hashPassword(pass), mustChangePassword: true,
      },
    });
    await db.researcher.update({ where: { id: r.id }, data: { userId: u.id } });
    await notify([u.id], { type: "SYSTEM", title: "مرحباً بك في منظومة إدارة البحث العلمي", body: "يرجى تغيير كلمة المرور المؤقتة واستكمال ملفك البحثي.", link: "/profile" });
    rows.push([r.fullName, r.universityId, r.department?.name ?? "—", email, pass, DEGREE_LABELS[r.academicDegree]]);
    created++;
  }
  await audit({ userId: user.id, action: "CREATE", entity: "User", summary: `إنشاء حسابات دخول جماعية لأعضاء هيئة التدريس: ${created} حساب` });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("حسابات الدخول", { views: [{ rightToLeft: true }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.headerFooter.oddHeader = "&C&10سري — يُسلَّم لكل عضو على حدة";
  ws.headerFooter.oddFooter = `&C&9${WATERMARK_TEXT}`;
  ws.addRow([`${INSTITUTE_NAME} — حسابات الدخول لأعضاء هيئة التدريس`]).font = { bold: true, size: 13, color: { argb: "FF0F2A4A" } };
  ws.mergeCells(1, 1, 1, 6);
  ws.addRow([`تاريخ الإنشاء: ${new Date().toISOString().slice(0, 10)} — عدد الحسابات الجديدة: ${created}. كلمات المرور مؤقتة ويُطلب تغييرها عند أول دخول. احذف هذا الملف بعد تسليم البيانات.`]);
  ws.mergeCells(2, 1, 2, 6);
  ws.getRow(2).font = { color: { argb: "FFB42318" }, bold: true };
  const h = ws.addRow(["الاسم", "الرمز (الرقم الوظيفي)", "القسم", "اسم الدخول (البريد)", "كلمة المرور المؤقتة", "ملاحظة"]);
  h.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2A4A" } }; });
  rows.forEach((r) => ws.addRow(r));
  [28, 18, 30, 32, 20, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(5).font = { name: "Consolas", bold: true };
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return fileResponse(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `حسابات-أعضاء-هيئة-التدريس-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
