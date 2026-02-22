import { NextResponse } from "next/server";
import {
  createCustomer,
  createCustomerSession,
  createSessionToken,
  getCustomerByEmail,
  issueEmailVerificationCode,
} from "@/lib/identity";
import { sendVerificationCodeEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Locale = "en" | "ar";

type SignupBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  country?: string;
  password?: string;
  locale?: string;
};

function parseLocale(v: string | undefined): Locale {
  return v === "ar" ? "ar" : "en";
}

export async function POST(req: Request) {
  const body: SignupBody = await req.json().catch((): SignupBody => ({}));

  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const addressLine1 = String(body.addressLine1 ?? "").trim();
  const city = String(body.city ?? "").trim();
  const country = String(body.country ?? "").trim() || "Jordan";
  const password = String(body.password ?? "").trim();
  const locale: Locale = parseLocale(body.locale);

  if (!fullName || !email || !phone || !addressLine1 || !password) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (name, email, phone, address, password)." },
      { status: 400 },
    );
  }

  const exists = await getCustomerByEmail(email);
  if (exists) {
    return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
  }

  const created = await createCustomer({
    email,
    fullName,
    password,
    phone,
    addressLine1,
    city,
    country,
  });

  // ✅ FIX: generate session token correctly
  const token = createSessionToken();
  await createCustomerSession(created.id, token);

  // Issue verification code (email sending is build-safe; function logs if env missing)
  try {
    const v = await issueEmailVerificationCode(created.id);
    if (v.ok) await sendVerificationCodeEmail(email, v.code, locale);
  } catch (e: unknown) {
    console.warn("[verify] could not issue verification code:", e);
  }

  const res = NextResponse.json({ ok: true, needsVerification: true });

  res.cookies.set("nivran_customer_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
