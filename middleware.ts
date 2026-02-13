import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED = new Set(["en", "ar"]);
const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const seg1 = pathname.split("/")[1];
  if (SUPPORTED.has(seg1)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"]
};
