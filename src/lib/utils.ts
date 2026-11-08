import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});
const shortFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDate(d?: Date | string | null) {
  if (!d) return "—";
  return dateFmt.format(new Date(d));
}
export function formatDateTime(d?: Date | string | null) {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d));
}
/** yyyy-mm-dd للاستخدام في حقول التاريخ */
export function toInputDate(d?: Date | string | null) {
  if (!d) return "";
  return shortFmt.format(new Date(d));
}
export function formatBytes(n: number) {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(2)} م.ب`;
}
export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}
export function relativeTime(d: Date | string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 86400 * 30) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return formatDate(d);
}
/** تهريب نص لاستخدامه داخل قوالب HTML المولدة على الخادم (PDF) */
export function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000);
}
