import { redirect } from "next/navigation";
import { ShieldCheck, FileSearch, Archive } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, APP_NAME_EN, INSTITUTE_NAME, INSTITUTE_NAME_EN, LOGO_PATH } from "@/lib/constants";
import Link from "next/link";
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
        <div className="relative flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_PATH} alt="شعار المعهد" className="size-20 rounded-full bg-white p-1 shadow-lg" />
          <div>
            <p className="text-lg font-extrabold">{INSTITUTE_NAME}</p>
            <p className="text-xs text-white/60" dir="ltr">{INSTITUTE_NAME_EN}</p>
            <p className="mt-1 text-sm font-bold text-sky-200">{APP_NAME}</p>
            <p className="text-[11px] text-white/50" dir="ltr">{APP_NAME_EN}</p>
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-3xl leading-snug font-extrabold">قاعدة بيانات مركزية للإنتاج العلمي<br />لأعضاء هيئة التدريس والباحثين</h2>
          <ul className="space-y-3 text-white/80">
            <li className="flex items-center gap-3"><FileSearch className="size-5 text-sky-300" /> توثيق البحوث والمشاريع والمؤتمرات والأنشطة العلمية</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-5 text-sky-300" /> تحكيم علمي سري بصلاحيات دقيقة</li>
            <li className="flex items-center gap-3"><Archive className="size-5 text-sky-300" /> أرشيف إلكتروني وتقارير قابلة للتصدير</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} مكتب البحث العلمي — {INSTITUTE_NAME} · <Link href="/portal" className="underline">البوابة العامة للبحث العلمي</Link></p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card/95 p-8 shadow-xl">
          <div className="mb-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_PATH} alt="شعار المعهد العالي للتقنيات الهندسية – بنغازي" className="mx-auto mb-3 size-24 rounded-full bg-white p-1 shadow" />
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{INSTITUTE_NAME} — مكتب البحث العلمي</p>
            <h1 className="text-2xl font-extrabold text-navy">تسجيل الدخول</h1>
            <p className="mt-1 text-sm text-muted-foreground">أدخل بيانات حسابك للوصول إلى النظام</p>
          </div>
          <LoginForm next={next} />
          <p className="mt-4 text-center text-sm"><Link href="/portal" className="font-semibold text-brand hover:underline">تصفح البوابة العامة للبحث العلمي دون تسجيل دخول ←</Link></p>
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
