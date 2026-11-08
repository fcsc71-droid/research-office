"use client";
import * as React from "react";
import { useActionState, useEffect, useRef, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
const FieldErrorsCtx = createContext<ActionResult["fieldErrors"]>(undefined);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  ...rest
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (r: ActionResult) => void;
} & Omit<React.ComponentProps<"form">, "action" | "onSubmit">) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ts]);

  return (
    <FieldErrorsCtx.Provider value={state?.ok ? undefined : state?.fieldErrors}>
      <form ref={ref} action={formAction} className={cn(className)} {...rest}>
        {children}
      </form>
    </FieldErrorsCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const errors = useContext(FieldErrorsCtx);
  const msg = errors?.[name]?.[0];
  if (!msg) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{msg}</p>;
}
