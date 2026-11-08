import "server-only";

export function contentDisposition(name: string, inline = false) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function fileResponse(body: Buffer, mime: string, name: string, inline = false) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": contentDisposition(name, inline),
      "Content-Length": String(body.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** حماية CSRF لواجهات POST: يجب أن يطابق Origin مضيف الطلب */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // طلبات من نفس الصفحة بدون Origin (GET/نماذج قديمة)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
