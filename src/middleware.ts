import { NextRequest, NextResponse } from "next/server";

export function adminMiddleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const adminToken = process.env.ADMIN_TOKEN || "";
  const cookieToken = req.cookies.get("admin_token")?.value || "";

  const isAdminRoute = path.startsWith("/admin");
  const isAdminApi = path.startsWith("/api/admin");
  const isAdminLoginPage = path === "/admin/login";
  const isAdminLoginApi = path === "/api/admin/login";

  if (!isAdminRoute && !isAdminApi) return NextResponse.next();
  if (isAdminLoginPage || isAdminLoginApi) return NextResponse.next();

  if (!adminToken) {
    return isAdminApi
      ? NextResponse.json({ ok: false, error: "ADMIN_TOKEN not configured" }, { status: 500 })
      : NextResponse.redirect(new URL("/admin/login", req.url));
  }

  if (cookieToken !== adminToken) {
    if (isAdminApi) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export function middleware(req: NextRequest) {
  return adminMiddleware(req);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
