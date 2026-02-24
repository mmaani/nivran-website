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
  full_name?: string;
  name?: string;

  email?: string;

  phone?: string;
  mobile?: string;

  addressLine1?: string;
  address1?: string;
  address?: string;

  city?: string;
  country?: string;

  password?: string;

  locale?: string;
};

function parseLocale(v: unknown): Locale {
  return v === "ar" ? "ar" : "en";
}

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isValidEmail(email: string): boolean {
  // Lightweight sanity check; real validation happens by sending a verification email anyway.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  let body: SignupBody = {};
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    body = {};
  }

  // Accept common alternate keys to avoid UI/API drift
  const fullName =
    asTrimmedString(body.fullName) ||
    asTrimmedString(body.full_name) ||
    asTrimmedString(body.name);

  const email = asTrimmedString(body.email).toLowerCase();
  const phone = asTrimmedString(body.phone) || asTrimmedString(body.mobile);

  const addressLine1 =
    asTrimmedString(body.addressLine1) ||
    asTrimmedString(body.address1) ||
    asTrimmedString(body.address);

  // Give safe defaults to avoid DB NOT NULL crashes
  const city = asTrimmedString(body.city) || "Amman";
  const country = asTrimmedString(body.country) || "Jordan";

  const password = asTrimmedString(body.password);
  const locale: Locale = parseLocale(body.locale);

  // Validate required fields
  const missing: string[] = [];
  if (!fullName) missing.push("fullName");
  if (!email) missing.push("email");
  if (!phone) missing.push("phone");
  if (!addressLine1) missing.push("addressLine1");
  if (!password) missing.push("password");

  if (missing.length) {
    return NextResponse.json(
      { ok: false, error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const exists = await getCustomerByEmail(email);
    if (exists) {
      return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
    }

    // Create customer (most common 500 happens inside here)
    const created = await createCustomer({
      email,
      fullName,
      password,
      phone,
      addressLine1,
      city,
      country,
    });

    // Create session
    const token = createSessionToken();
    await createCustomerSession(created.id, token);

    // Issue verification code + send email (non-fatal)
    try {
      const v = await issueEmailVerificationCode(created.id);
      if (v.ok) await sendVerificationCodeEmail(email, v.code, locale);
    } catch (e) {
      console.warn("[signup] verification issue (non-fatal):", e);
    }

    const res = NextResponse.json({ ok: true, needsVerification: true }, { status: 200 });

    res.cookies.set("nivran_customer_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e: unknown) {
    // IMPORTANT: log the raw error so you can see it in Vercel logs
    console.error("[signup] fatal error:", e);

    // Provide a safe message to client
    return NextResponse.json(
      { ok: false, error: "Signup failed due to a server error. Please try again." },
      { status: 500 },
    );
  }
}