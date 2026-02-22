import { NextResponse } from "next/server";
import {
  confirmEmailVerificationCode,
  CUSTOMER_SESSION_COOKIE,
  ensureIdentityTables,
  getCustomerIdFromRequest,
  rotateCustomerSession,
} from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = { code?: string; locale?: string };

export async function POST(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });

  const bodyUnknown: unknown = await req.json().catch(() => ({}));
  const body: ReqBody = typeof bodyUnknown === "object" && bodyUnknown !== null ? (bodyUnknown as ReqBody) : {};
  const code = typeof body.code === "string" ? body.code : "";

  const r = await confirmEmailVerificationCode(customerId, code);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "INVALID" }, { status: 400 });

  // OWASP-style session rotation after privilege change (email verification)
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${CUSTOMER_SESSION_COOKIE}=([^;]+)`));
  const current = m ? decodeURIComponent(m[1]) : "";

  const res = NextResponse.json({ ok: true });
  if (current) {
    const next = await rotateCustomerSession(customerId, current);
    res.cookies.set(CUSTOMER_SESSION_COOKIE, next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
