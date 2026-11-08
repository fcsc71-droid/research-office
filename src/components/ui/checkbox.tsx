import * as React from "react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn("size-4 rounded border-input accent-[var(--brand)] cursor-pointer", className)} {...props} />;
}
export { Checkbox };
