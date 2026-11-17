import { Paperclip } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export function AttachmentList({ items }: { items?: { id: string; originalName: string; size: number; title?: string | null }[] }) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <li key={a.id}>
          <a href={`/api/attachments/${a.id}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs text-brand hover:bg-accent">
            <Paperclip className="size-3" /> {a.title || a.originalName} <span className="text-muted-foreground">({formatBytes(a.size)})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
