import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));
  res.cookies.set("admin_token", "", { path: "/", maxAge: 0 });
  return res;
}
