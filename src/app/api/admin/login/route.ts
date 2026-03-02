import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSignedAdminToken } from "@/lib/adminSession";
import { getClientIp, rateLimitCheck } from "@/lib/rateLimit";

export const runtime = "nodejs";

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export async function POST(req: Request) {
  const adminToken = process.env.ADMIN_TOKEN || "";
  if (!adminToken) {
    return NextResponse.json({ ok: false, error: "ADMIN_TOKEN not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = String(body?.token || "").trim();
  const clientIp = getClientIp(req);

  const limit = await rateLimitCheck({
    key: `admin-login:${clientIp}`,
    action: "admin_login",
    windowSeconds: 15 * 60,
    maxInWindow: 12,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  if (!safeEq(token, adminToken.trim())) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const signedToken = createSignedAdminToken(60 * 60 * 12);
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  };
  res.cookies.set("admin_token", signedToken, opts);
  res.cookies.set("nivran_admin_token", signedToken, opts);
  res.cookies.set("nivran_admin_role", "", { ...opts, maxAge: 0 });
  res.cookies.set("nivran_staff_id", "", { ...opts, maxAge: 0 });
  res.cookies.set("nivran_staff_user", "", { ...opts, maxAge: 0 });
  res.cookies.set("nivran_staff_sig", "", { ...opts, maxAge: 0 });
  return res;
}
