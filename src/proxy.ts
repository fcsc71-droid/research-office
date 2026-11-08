import { NextResponse, type NextRequest } from "next/server";

// فحص مبدئي متفائل: إعادة توجيه غير المسجلين لصفحة الدخول.
// التحقق الفعلي من الجلسة والصلاحيات يتم على الخادم في كل صفحة وإجراء وواجهة برمجية.
const PUBLIC = ["/login", "/api/cron"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("ro_session");
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!hasSession) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)"],
};
