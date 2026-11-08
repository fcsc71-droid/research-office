"use client";
import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function FilePreviewButton({ fileId, name, kind }: { fileId: string; name: string; kind: "pdf" | "image" }) {
  const [open, setOpen] = useState(false);
  const src = `/api/files/${fileId}?inline=1`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="معاينة"><Eye /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader><DialogTitle className="truncate pe-6">{name}</DialogTitle></DialogHeader>
        {open && (kind === "pdf" ? (
          <iframe src={src} title={name} className="h-[75vh] w-full rounded-md border" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="mx-auto max-h-[75vh] rounded-md border" />
        ))}
      </DialogContent>
    </Dialog>
  );
}
