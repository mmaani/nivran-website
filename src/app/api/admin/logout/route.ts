import { NextResponse } from "next/server";

export const runtime = "nodejs";

function buildResponse(req: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));
  const opts = {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
  res.cookies.set("admin_token", "", opts);
  res.cookies.set("nivran_admin_token", "", opts);
  res.cookies.set("admin_token_client", "", opts);
  res.cookies.set("nivran_admin_role", "", opts);
  res.cookies.set("nivran_staff_id", "", opts);
  res.cookies.set("nivran_staff_user", "", opts);
  res.cookies.set("nivran_staff_sig", "", opts);
  return res;
}

export async function POST(req: Request) {
  return buildResponse(req);
}

export async function GET(req: Request) {
  return buildResponse(req);
}
