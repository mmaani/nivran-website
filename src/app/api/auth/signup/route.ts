// src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createCustomer, createSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/identity";

export const runtime = "nodejs";

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

export async function POST(req: Request): Promise<Response> {
  const ct = req.headers.get("content-type") || "";
  const isForm = ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
  const body = isForm ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => ({}));

  const email = String((body as any)?.email || "").trim().toLowerCase();
  const password = String((body as any)?.password || "").trim();
  const fullName = String((body as any)?.full_name || (body as any)?.fullName || "").trim() || null;
  const locale = String((body as any)?.locale || "en") === "ar" ? "ar" : "en";

  if (!email || !email.includes("@") || password.length < 6) {
    const payload = { ok: false, error: "Invalid email or password" };
    if (isForm) return NextResponse.redirect(new URL(`/${locale}?signup=0`, req.url));
    return NextResponse.json(payload, { status: 400 });
  }

  const id = await createCustomer({ email, fullName, password });
  if (!id) {
    const payload = { ok: false, error: "Email already registered" };
    if (isForm) return NextResponse.redirect(new URL(`/${locale}?signup=exists`, req.url));
    return NextResponse.json(payload, { status: 409 });
  }

  // ✅ FIX: createSessionToken requires customerId
  const token = await createSessionToken(id);

  const res = isForm
    ? NextResponse.redirect(new URL(`/${locale}?signup=1`, req.url))
    : NextResponse.json({ ok: true });

  res.cookies.set(CUSTOMER_SESSION_COOKIE, token, cookieOpts());
  return res;
}
