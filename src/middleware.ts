import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";

  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const configured = process.env.ADMIN_TOKEN || "";
  if (!configured) {
    if (isAdminApi) {
      return NextResponse.json({ ok: false, error: "ADMIN_TOKEN not configured" }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/admin/login?error=missing-admin-token", req.url));
  }

  const cookieToken = req.cookies.get("admin_token")?.value || "";
  if (cookieToken === configured) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const next = encodeURIComponent(`${pathname}${search || ""}`);
  return NextResponse.redirect(new URL(`/admin/login?next=${next}`, req.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
