import { UserCircle, KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileAction, changePasswordAction } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActionForm, FieldError } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { Field, InfoRow, PageHeader } from "@/components/app/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "الملف الشخصي" };

export default async function ProfilePage() {
  const me = await requireUser();
  const u = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    include: { role: true, department: true, college: true, researcher: { select: { universityId: true } }, sessions: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader icon={<UserCircle />} title="الملف الشخصي" description="بيانات حسابك وإعدادات الأمان" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>معلومات الحساب</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="البريد الإلكتروني"><span dir="ltr">{u.email}</span></InfoRow>
              <InfoRow label="الدور"><Badge variant="secondary">{u.role.name}</Badge></InfoRow>
              {u.researcher && <InfoRow label="الرقم الجامعي">{u.researcher.universityId}</InfoRow>}
              <InfoRow label="الكلية / القسم">{[u.college?.name, u.department?.name].filter(Boolean).join(" — ") || "—"}</InfoRow>
              <InfoRow label="آخر دخول">{formatDateTime(u.lastLoginAt)}</InfoRow>
              <InfoRow label="الصلاحيات">{me.roleKey === "ADMIN" ? "جميع الصلاحيات" : `${me.permissions.size} صلاحية`}</InfoRow>
            </dl>
            <ActionForm action={updateProfileAction} className="mt-4 grid gap-3 border-t pt-4">
              <Field label="الاسم" required><Input name="name" defaultValue={u.name} required /><FieldError name="name" /></Field>
              <Field label="رقم الهاتف"><Input name="phone" defaultValue={u.phone ?? ""} dir="ltr" className="text-left" /></Field>
              <SubmitButton className="w-fit">حفظ البيانات</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-brand" /> تغيير كلمة المرور</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={changePasswordAction} resetOnSuccess className="grid gap-3">
              <Field label="كلمة المرور الحالية" required><Input type="password" name="current" required autoComplete="current-password" dir="ltr" /><FieldError name="current" /></Field>
              <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل وتحتوي حرفاً ورقماً"><Input type="password" name="next" required autoComplete="new-password" dir="ltr" /><FieldError name="next" /></Field>
              <Field label="تأكيد كلمة المرور" required><Input type="password" name="confirm" required autoComplete="new-password" dir="ltr" /><FieldError name="confirm" /></Field>
              <SubmitButton className="w-fit">تغيير كلمة المرور</SubmitButton>
            </ActionForm>
            <div className="mt-5 border-t pt-4">
              <p className="mb-2 text-sm font-bold text-navy">الجلسات الأخيرة</p>
              {u.sessions.map((s) => (
                <p key={s.id} className="truncate text-xs text-muted-foreground" dir="ltr">{formatDateTime(s.createdAt)} — {s.ipAddress ?? "local"} — {s.userAgent?.slice(0, 60)}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
