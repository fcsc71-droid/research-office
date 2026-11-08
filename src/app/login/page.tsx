import { redirect } from "next/navigation";
import { FlaskConical, ShieldCheck, FileSearch, Archive } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, APP_NAME_EN } from "@/lib/constants";
import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-32 right-0 size-96 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <FlaskConical className="size-6" />
          </div>
          <div>
            <p className="text-lg font-extrabold">{APP_NAME}</p>
            <p className="text-xs text-white/60" dir="ltr">{APP_NAME_EN}</p>
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-3xl leading-snug font-extrabold">منصة موحدة لإدارة دورة حياة البحث العلمي<br />من التقديم حتى النشر والأرشفة</h2>
          <ul className="space-y-3 text-white/80">
            <li className="flex items-center gap-3"><FileSearch className="size-5 text-sky-300" /> استقبال الأبحاث ومراجعتها وتتبع حالتها</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-5 text-sky-300" /> تحكيم علمي سري بصلاحيات دقيقة</li>
            <li className="flex items-center gap-3"><Archive className="size-5 text-sky-300" /> أرشيف إلكتروني وتقارير قابلة للتصدير</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} مكتب الأبحاث العلمية</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card/95 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-navy text-white lg:hidden">
              <FlaskConical className="size-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-navy">تسجيل الدخول</h1>
            <p className="mt-1 text-sm text-muted-foreground">أدخل بيانات حسابك للوصول إلى النظام</p>
          </div>
          <LoginForm next={next} />
          {isDev && (
            <div className="mt-6 rounded-lg border border-dashed border-brand/40 bg-brand-soft/40 p-3 text-xs leading-6 text-navy">
              <p className="mb-1 font-bold">حسابات تجريبية (بيئة التطوير فقط) — كلمة المرور: <span dir="ltr" className="font-mono">Password@123</span></p>
              <ul dir="ltr" className="grid gap-0.5 text-left font-mono">
                <li>admin@research.local — مدير النظام</li>
                <li>manager@research.local — مدير المكتب</li>
                <li>staff@research.local — موظف إداري</li>
                <li>researcher@research.local — باحث</li>
                <li>reviewer@research.local — محكم</li>
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
