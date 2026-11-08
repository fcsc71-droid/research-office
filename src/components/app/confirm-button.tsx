"use client";
import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action";

export function ConfirmButton({
  action,
  title = "تأكيد العملية",
  description = "هل أنت متأكد من تنفيذ هذا الإجراء؟",
  confirmText = "تأكيد",
  children,
  variant = "outline",
  size = "sm",
  confirmVariant = "destructive",
  className,
}: {
  action: () => Promise<ActionResult>;
  title?: string;
  description?: string;
  confirmText?: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant={confirmVariant}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await action();
                if (r.ok) {
                  toast.success(r.message ?? "تم التنفيذ بنجاح");
                  setOpen(false);
                  if (r.redirectTo) router.push(r.redirectTo);
                  else router.refresh();
                } else toast.error(r.error ?? "تعذر التنفيذ");
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmText}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
