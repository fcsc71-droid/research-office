import { KeyRound, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveRolePermissionsAction } from "@/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { PageHeader } from "@/components/app/misc";

export const metadata = { title: "الأدوار والصلاحيات" };

export default async function RolesPage() {
  await requirePermission("roles.manage");
  const [roles, perms] = await Promise.all([
    db.role.findMany({ include: { permissions: true, _count: { select: { users: true } } }, orderBy: { createdAt: "asc" } }),
    db.permission.findMany({ orderBy: [{ group: "asc" }, { code: "asc" }] }),
  ]);
  const groups = [...new Set(perms.map((p) => p.group))];
  return (
    <div className="grid gap-5">
      <PageHeader icon={<KeyRound />} title="الأدوار والصلاحيات" description="التحكم الدقيق في صلاحيات كل دور. تُطبّق الصلاحيات على الخادم في كل صفحة وإجراء." />
      {roles.map((role) => {
        const has = new Set(role.permissions.map((p) => p.permissionId));
        const locked = role.key === "ADMIN";
        return (
          <Card key={role.id}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> {role.name}</CardTitle>
                <CardDescription>{role._count.users} مستخدم · {locked ? "جميع الصلاحيات (غير قابلة للتعديل)" : `${has.size} صلاحية`}</CardDescription>
              </div>
              <Badge variant="outline" dir="ltr" className="font-mono">{role.key}</Badge>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveRolePermissionsAction.bind(null, role.id)} className="grid gap-4">
                <fieldset disabled={locked} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groups.map((g) => (
                    <div key={g} className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-bold text-navy">{g}</p>
                      <div className="grid gap-1.5">
                        {perms.filter((p) => p.group === g).map((p) => (
                          <label key={p.id} className="flex items-start gap-2 text-sm">
                            <Checkbox name="perm" value={p.code} defaultChecked={locked || has.has(p.id)} className="mt-1" />
                            <span>{p.name} <span dir="ltr" className="block font-mono text-[10px] text-muted-foreground">{p.code}</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </fieldset>
                {!locked && <SubmitButton className="w-fit">حفظ صلاحيات {role.name}</SubmitButton>}
              </ActionForm>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
