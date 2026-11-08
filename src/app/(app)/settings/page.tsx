import { Settings, Database, Download, Droplets } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listBackups } from "@/lib/backup";
import { saveSettingsAction, createBackupAction } from "@/actions/admin";
import { WATERMARK_TEXT } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionForm, FieldError } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { ConfirmButton } from "@/components/app/confirm-button";
import { Field, PageHeader } from "@/components/app/misc";
import { formatBytes, formatDateTime } from "@/lib/utils";

export const metadata = { title: "إعدادات النظام" };

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3">
      <Checkbox name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span><span className="block text-sm font-semibold">{label}</span>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  );
}

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [s, backups] = await Promise.all([getSettings(), listBackups()]);
  return (
    <div className="grid gap-5">
      <PageHeader icon={<Settings />} title="إعدادات النظام" description="الإعدادات العامة، العلامة المائية، الملفات، التحكيم، والنسخ الاحتياطي" />
      <ActionForm action={saveSettingsAction} className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الإعدادات العامة</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="اسم الجامعة / المؤسسة" required><Input name="universityName" defaultValue={s.universityName} required /></Field>
            <Field label="اسم المكتب" required><Input name="officeName" defaultValue={s.officeName} required /></Field>
            <Field label="بادئة الرقم المرجعي" hint="مثال: RES ← RES-2026-0001"><Input name="referencePrefix" defaultValue={s.referencePrefix} dir="ltr" className="max-w-40 text-left" required /><FieldError name="referencePrefix" /></Field>
            <Toggle name="allowResearcherSelfSubmit" label="السماح للباحث بتقديم البحث مباشرة" defaultChecked={s.allowResearcherSelfSubmit} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Droplets className="size-4 text-brand" /> العلامة المائية</CardTitle>
            <CardDescription>النص: «{WATERMARK_TEXT}» — تظهر دائماً في خلفية صفحات النظام.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Toggle name="watermarkInExports" label="إظهار العلامة المائية في المخرجات (PDF، Excel، الطباعة)" hint="مفعّلة افتراضياً — تُضاف بشكل قطري خفيف لا يعيق القراءة" defaultChecked={s.watermarkInExports} />
            <Toggle name="watermarkOnDownloads" label="ختم ملفات PDF المرفوعة بالعلامة المائية عند تنزيلها" hint="لا يُعدَّل الملف الأصلي المخزن" defaultChecked={s.watermarkOnDownloads} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الملفات والتحكيم</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="الحد الأقصى لحجم الملف (م.ب)"><Input type="number" name="maxUploadMb" min={1} max={50} defaultValue={s.maxUploadMb} required /><FieldError name="maxUploadMb" /></Field>
            <Field label="مدة التحكيم الافتراضية (يوم)"><Input type="number" name="defaultReviewDays" min={1} max={120} defaultValue={s.defaultReviewDays} required /></Field>
            <Field label="التنبيه قبل الموعد بـ (يوم)"><Input type="number" name="deadlineReminderDays" min={1} max={30} defaultValue={s.deadlineReminderDays} required /></Field>
            <div className="sm:col-span-3"><Toggle name="blindReview" label="التحكيم المعمّى" hint="إخفاء أسماء الباحثين عن المحكمين" defaultChecked={s.blindReview} /></div>
          </CardContent>
        </Card>
        <div className="flex items-end lg:col-span-2"><SubmitButton size="lg">حفظ الإعدادات</SubmitButton></div>
      </ActionForm>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Database className="size-4 text-brand" /> النسخ الاحتياطي لقاعدة البيانات</CardTitle>
            <CardDescription>نسخة كاملة بتنسيق pg_dump المضغوط. للاستعادة: <span dir="ltr" className="font-mono">pg_restore --clean -d DATABASE_URL file.dump</span></CardDescription>
          </div>
          <ConfirmButton action={createBackupAction} title="إنشاء نسخة احتياطية" description="سيتم إنشاء نسخة احتياطية كاملة لقاعدة البيانات الآن." confirmText="إنشاء" confirmVariant="default" variant="default" size="default">
            <Database /> إنشاء نسخة الآن
          </ConfirmButton>
        </CardHeader>
        <CardContent className="grid gap-2">
          {backups.length === 0 && <p className="text-sm text-muted-foreground">لا توجد نسخ احتياطية بعد.</p>}
          {backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="font-mono text-xs" dir="ltr">{b.name}</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {formatBytes(b.size)} · {formatDateTime(b.createdAt)}
                <Button asChild variant="ghost" size="icon-sm"><a href={`/api/backup?name=${encodeURIComponent(b.name)}`} title="تنزيل"><Download /></a></Button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
