import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as identity from "@/lib/identity";

export const runtime = "nodejs";

function createResetTokenFallback() {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(req: Request) {
  await identity.ensureIdentityTables();
  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email || "").trim().toLowerCase();
  const locale = String(body?.locale || "en") === "ar" ? "ar" : "en";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Valid email is required" }, { status: 400 });
  }

  const { rows } = await db.query<{ id: number }>(
    `select id from customers where lower(email)=lower($1) and is_active=true limit 1`,
    [email]
  );

  if (rows[0]?.id) {
    const createToken = (identity as any).createPasswordResetToken as (() => string) | undefined;
    const token = (createToken || createResetTokenFallback)();

    await db.query(
      `insert into customer_password_reset_tokens (customer_id, token, expires_at)
       values ($1,$2, now() + interval '1 hour')`,
      [rows[0].id, token]
    );

    const base = process.env.APP_BASE_URL || new URL(req.url).origin;
    const resetUrl = `${base}/${locale}/account/reset-password?token=${encodeURIComponent(token)}`;

    return NextResponse.json({
      ok: true,
      message: "If this email exists, a reset link has been generated.",
      resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    });
  }

  return NextResponse.json({ ok: true, message: "If this email exists, a reset link has been generated." });
}
