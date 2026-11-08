import type { Metadata, Viewport } from "next";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Watermark } from "@/components/app/misc";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "نظام متكامل لإدارة الأبحاث العلمية والتحكيم والأرشفة",
};
export const viewport: Viewport = { themeColor: "#0f2a4a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">
        <Watermark />
        <div className="relative z-[1]">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
