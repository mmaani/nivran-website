import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, ensureIdentityTables, verifyPassword } from "@/lib/identity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureIdentityTables();
  const input = await req.json().catch(() => ({} as any));
  const email = String(input?.email || "").trim().toLowerCase();
  const password = String(input?.password || "");

  const { rows } = await db.query<{ id: number; password_hash: string; is_active: boolean }>(
    `select id, password_hash, is_active from customers where email=$1 limit 1`,
    [email]
  );

  const c = rows[0];
  if (!c || !c.is_active || !verifyPassword(password, c.password_hash)) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken();
  await db.query(`insert into customer_sessions (customer_id, token, expires_at) values ($1,$2, now() + interval '30 days')`, [c.id, token]);

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
