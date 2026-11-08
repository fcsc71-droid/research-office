"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      dir="rtl"
      position="top-center"
      richColors
      closeButton
      toastOptions={{ style: { fontFamily: "Cairo, sans-serif" } }}
      {...props}
    />
  );
}
