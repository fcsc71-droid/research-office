import { Building2, Plus, PenLine, Trash2, Tags } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  saveCollegeAction, deleteCollegeAction, saveDepartmentAction, deleteDepartmentAction, saveCategoryAction, deleteCategoryAction,
} from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { Field, PageHeader, EmptyState } from "@/components/app/misc";
import { FieldError } from "@/components/app/action-form";

export const metadata = { title: "الكليات والأقسام" };

export default async function StructurePage() {
  await requirePermission("structure.manage");
  const [colleges, categories] = await Promise.all([
    db.college.findMany({
      orderBy: { name: "asc" },
      include: { departments: { orderBy: { name: "asc" }, include: { _count: { select: { papers: true, researchers: true } } } }, _count: { select: { papers: true } } },
    }),
    db.researchCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { papers: true } } } }),
  ]);
  const collegeFields = (c?: { name: string; code: string | null; description: string | null }) => (
    <>
      <Field label="اسم الكلية" required><Input name="name" defaultValue={c?.name} required /><FieldError name="name" /></Field>
      <Field label="الرمز"><Input name="code" defaultValue={c?.code ?? ""} dir="ltr" className="text-left" /></Field>
      <Field label="الوصف"><Textarea name="description" defaultValue={c?.description ?? ""} rows={2} /></Field>
    </>
  );
  const deptFields = (d?: { name: string; code: string | null; collegeId: string }, collegeId?: string) => (
    <>
      <Field label="الكلية" required>
        <NativeSelect name="collegeId" defaultValue={d?.collegeId ?? collegeId ?? ""} required>
          <option value="">— اختر —</option>
          {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="اسم القسم" required><Input name="name" defaultValue={d?.name} required /><FieldError name="name" /></Field>
      <Field label="الرمز"><Input name="code" defaultValue={d?.code ?? ""} dir="ltr" className="text-left" /></Field>
    </>
  );
  const catFields = (c?: { name: string; description: string | null }) => (
    <>
      <Field label="اسم التخصص" required><Input name="name" defaultValue={c?.name} required /><FieldError name="name" /></Field>
      <Field label="الوصف"><Textarea name="description" defaultValue={c?.description ?? ""} rows={2} /></Field>
    </>
  );

  return (
    <div>
      <PageHeader icon={<Building2 />} title="الكليات والأقسام والتخصصات" description="إدارة الهيكل الأكاديمي المستخدم في تصنيف الأبحاث والباحثين" />
      <Tabs defaultValue="colleges">
        <TabsList>
          <TabsTrigger value="colleges"><Building2 /> الكليات والأقسام</TabsTrigger>
          <TabsTrigger value="categories"><Tags /> التخصصات البحثية</TabsTrigger>
        </TabsList>
        <TabsContent value="colleges" className="grid gap-4">
          <div className="flex gap-2">
            <FormDialog trigger={<Button><Plus /> إضافة كلية</Button>} title="إضافة كلية" action={saveCollegeAction.bind(null, null)}>{collegeFields()}</FormDialog>
            {colleges.length > 0 && <FormDialog trigger={<Button variant="outline"><Plus /> إضافة قسم</Button>} title="إضافة قسم" action={saveDepartmentAction.bind(null, null)}>{deptFields()}</FormDialog>}
          </div>
          {colleges.length === 0 && <Card><EmptyState title="لا توجد كليات" description="ابدأ بإضافة الكليات ثم الأقسام التابعة لها" /></Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            {colleges.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle>{c.name} {c.code && <Badge variant="outline" className="ms-1 font-mono" dir="ltr">{c.code}</Badge>}</CardTitle>
                    <p className="text-xs text-muted-foreground">{c.departments.length} قسم · {c._count.papers} بحث</p>
                  </div>
                  <div className="flex gap-1">
                    <FormDialog trigger={<Button variant="ghost" size="icon-sm" title="إضافة قسم"><Plus /></Button>} title={`إضافة قسم إلى ${c.name}`} action={saveDepartmentAction.bind(null, null)}>{deptFields(undefined, c.id)}</FormDialog>
                    <FormDialog trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل الكلية" action={saveCollegeAction.bind(null, c.id)}>{collegeFields(c)}</FormDialog>
                    <ConfirmButton action={deleteCollegeAction.bind(null, c.id)} title="حذف الكلية" description="لا يمكن حذف كلية تحتوي أقساماً أو أبحاثاً." confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-1.5">
                  {c.departments.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أقسام</p>}
                  {c.departments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="font-semibold">{d.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{d._count.papers} بحث · {d._count.researchers} باحث</span>
                        <FormDialog trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل القسم" action={saveDepartmentAction.bind(null, d.id)}>{deptFields(d)}</FormDialog>
                        <ConfirmButton action={deleteDepartmentAction.bind(null, d.id)} title="حذف القسم" description="لا يمكن حذف قسم مرتبط بأبحاث أو باحثين." confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="categories" className="grid gap-4">
          <div><FormDialog trigger={<Button><Plus /> إضافة تخصص</Button>} title="إضافة تخصص بحثي" action={saveCategoryAction.bind(null, null)}>{catFields()}</FormDialog></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-start justify-between gap-2 pt-5">
                  <div><p className="font-bold text-navy">{c.name}</p><p className="text-xs text-muted-foreground">{c._count.papers} بحث</p>{c.description && <p className="mt-1 text-sm">{c.description}</p>}</div>
                  <div className="flex">
                    <FormDialog trigger={<Button variant="ghost" size="icon-sm" title="تعديل"><PenLine /></Button>} title="تعديل التخصص" action={saveCategoryAction.bind(null, c.id)}>{catFields(c)}</FormDialog>
                    <ConfirmButton action={deleteCategoryAction.bind(null, c.id)} title="حذف التخصص" description="لا يمكن حذف تخصص مرتبط بأبحاث." confirmText="حذف" variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></ConfirmButton>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
