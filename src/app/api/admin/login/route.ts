import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN || "";
  if (!adminToken) {
    return NextResponse.json({ ok: false, error: "ADMIN_TOKEN not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = String(body?.token || "");

  if (token !== adminToken) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
