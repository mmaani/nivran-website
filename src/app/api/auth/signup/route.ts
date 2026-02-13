import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, ensureIdentityTables, hashPassword } from "@/lib/identity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureIdentityTables();
  const input = await req.json().catch(() => ({} as any));

  const email = String(input?.email || "").trim().toLowerCase();
  const password = String(input?.password || "");
  const firstName = String(input?.firstName || "").trim() || null;
  const lastName = String(input?.lastName || "").trim() || null;
  const phone = String(input?.phone || "").trim() || null;
  const locale = String(input?.locale || "en") === "ar" ? "ar" : "en";

  if (!email.includes("@") || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Invalid email or weak password" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  const { rows } = await db.query<{ id: number }>(
    `insert into customers (email, password_hash, first_name, last_name, phone, locale)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (email) do nothing
     returning id`,
    [email, passwordHash, firstName, lastName, phone, locale]
  );

  if (!rows[0]?.id) {
    return NextResponse.json({ ok: false, error: "Email already exists" }, { status: 409 });
  }

  const token = createSessionToken();
  await db.query(
    `insert into customer_sessions (customer_id, token, expires_at)
     values ($1,$2, now() + interval '30 days')`,
    [rows[0].id, token]
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set("customer_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
