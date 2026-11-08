"use client";
import { useActionState } from "react";
import { Loader2, LogIn, Mail, Lock } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-1.5">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <div className="relative">
          <Mail className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" autoComplete="username" required dir="ltr" className="pe-9 text-left" placeholder="name@university.edu" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">كلمة المرور</Label>
        <div className="relative">
          <Lock className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" className="pe-9 text-left" />
        </div>
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {pending ? "جارٍ التحقق..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
