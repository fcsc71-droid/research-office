"use client";
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import type { ActionResult } from "@/lib/action";

/** نافذة حوارية تحتوي نموذجاً يرسل إلى Server Action */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  children,
  submitText = "حفظ",
  wide,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitText?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ActionForm action={action} className="grid gap-4" onSuccess={() => setOpen(false)}>
          {children}
          <div className="flex gap-2">
            <SubmitButton>{submitText}</SubmitButton>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
