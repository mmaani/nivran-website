// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { isDbConnectivityError } from "@/lib/db";
import {
  getCustomerByEmail,
  verifyPassword,
  createSessionToken,
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
} from "@/lib/identity";

export const runtime = "nodejs";

function cookieOpts(rememberMe: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  };
}

export async function POST(req: Request): Promise<Response> {
  const ct = req.headers.get("content-type") || "";
  const isForm = ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");

  try {
    const body = isForm ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => ({}));
    const input = body as Record<string, unknown>;

    const email = String(input?.email || "").trim().toLowerCase();
    const password = String(input?.password || "").trim();
    const rememberMe = Boolean(input?.rememberMe);
    const locale = String(input?.locale || "en") === "ar" ? "ar" : "en";

    const c = await getCustomerByEmail(email);
    if (!c || !c.is_active) {
      const payload = { ok: false, error: "Invalid credentials" };
      if (isForm) return NextResponse.redirect(new URL(`/${locale}?login=0`, req.url));
      return NextResponse.json(payload, { status: 401 });
    }

    const validPassword = await verifyPassword(password, c.password_hash);
    if (!validPassword) {
      const payload = { ok: false, error: "Invalid credentials" };
      if (isForm) return NextResponse.redirect(new URL(`/${locale}?login=0`, req.url));
      return NextResponse.json(payload, { status: 401 });
    }

    const token = createSessionToken();
    await createCustomerSession(c.id, token);

    const res = isForm
      ? NextResponse.redirect(new URL(`/${locale}?login=1`, req.url))
      : NextResponse.json({ ok: true, needsVerification: !c.email_verified_at });

    res.cookies.set(CUSTOMER_SESSION_COOKIE, token, cookieOpts(rememberMe));
    return res;
  } catch (e) {
    const payload = { ok: false, error: "TEMPORARY_ERROR" };
    if (isForm) return NextResponse.redirect(new URL(`/en?login=0`, req.url));
    if (isDbConnectivityError(e)) return NextResponse.json(payload, { status: 503 });
    return NextResponse.json(payload, { status: 500 });
  }
}
