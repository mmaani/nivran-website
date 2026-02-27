import { NextRequest, NextResponse } from "next/server";

function hasSalesSession(req: NextRequest): boolean {
  const role = (req.cookies.get("nivran_admin_role")?.value || "").trim();
  const staffId = (req.cookies.get("nivran_staff_id")?.value || "").trim();
  const username = (req.cookies.get("nivran_staff_user")?.value || "").trim();
  const sig = (req.cookies.get("nivran_staff_sig")?.value || "").trim();
  return role === "sales" && !!staffId && !!username && !!sig;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const adminToken = (process.env.ADMIN_TOKEN || "").trim();
  const cookieToken = (req.cookies.get("admin_token")?.value || req.cookies.get("nivran_admin_token")?.value || "").trim();

  const isAdminRoute = path.startsWith("/admin");
  const isAdminApi = path.startsWith("/api/admin");
  const isAdminLoginPage = path === "/admin/login";
  const isAdminLoginApi = path === "/api/admin/login" || path === "/api/admin/sales/login";

  if (!isAdminRoute && !isAdminApi) return NextResponse.next();
  if (isAdminLoginPage || isAdminLoginApi) return NextResponse.next();

  const isAdmin = !!adminToken && cookieToken === adminToken;
  const isSales = hasSalesSession(req);

  if (!isAdmin && !isSales) {
    if (isAdminApi) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isSales) {
    const allowedAdminRoutes = path === "/admin/sales" || path.startsWith("/admin/sales/");
    const allowedApiRoutes = path.startsWith("/api/admin/sales") || path === "/api/admin/logout" || path === "/api/admin/lang";

    if (isAdminRoute && !allowedAdminRoutes) {
      return NextResponse.redirect(new URL("/admin/sales", req.url));
    }
    if (isAdminApi && !allowedApiRoutes) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
