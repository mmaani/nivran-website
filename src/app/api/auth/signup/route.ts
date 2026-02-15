import { NextResponse } from "next/server";
import { createCustomer, createCustomerSession, createSessionToken, getCustomerByEmail } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const phone = String(body?.phone || "").trim();
  const addressLine1 = String(body?.addressLine1 || "").trim();
  const city = String(body?.city || "").trim();
  const country = String(body?.country || "").trim() || "Jordan";
  const password = String(body?.password || "").trim();

  if (!fullName || !email || !phone || !addressLine1 || !password) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (name, email, phone, address, password)." },
      { status: 400 }
    );
  }

  const exists = await getCustomerByEmail(email);
  if (exists) return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });

  const created = await createCustomer({
    email,
    fullName,
    password,
    phone,
    addressLine1,
    city,
    country,
  });

  const token = createSessionToken();
  await createCustomerSession(created.id, token);

  const res = NextResponse.json({ ok: true });

  res.cookies.set("nivran_customer_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
