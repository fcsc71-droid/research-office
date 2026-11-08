import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-card pe-3 ps-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute start-auto end-auto left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
export { NativeSelect };
