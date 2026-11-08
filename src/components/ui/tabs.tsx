"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root dir="rtl" data-slot="tabs" className={cn("flex flex-col gap-3", className)} {...props} />;
}
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground", className)}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-all cursor-pointer data-[state=active]:bg-card data-[state=active]:text-navy data-[state=active]:shadow-sm [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}
export { Tabs, TabsList, TabsTrigger, TabsContent };
