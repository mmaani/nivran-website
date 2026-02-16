import type { NextRequest } from "next/server";
import { adminMiddleware } from "@/middleware";

export function middleware(req: NextRequest) {
  return adminMiddleware(req);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
