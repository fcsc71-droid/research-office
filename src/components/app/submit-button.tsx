"use client";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText = "جارٍ الحفظ...",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}
