import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { ensureIdentityTables } from "@/lib/identity";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toEmail(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  // minimal email sanity (don’t over-reject valid emails)
  return s.includes("@") ? s : "";
}

function clampTtlMinutes(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 60;
  return Math.max(5, Math.min(24 * 60, Math.floor(n)));
}

function toLocale(v: unknown): "en" | "ar" {
  return String(v ?? "en") === "ar" ? "ar" : "en";
}

async function findCustomerByEmail(email: string): Promise<{ id: number; email: string } | null> {
  const r = await db.query<{ id: number; email: string }>(
    `select id, email
       from customers
      where lower(email)=lower($1) and is_active=true
      limit 1`,
    [email]
  );
  return r.rows[0] ?? null;
}

async function createResetToken(customerId: number, ttlMinutes: number): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await db.query(
    `insert into customer_password_reset_tokens (customer_id, token, expires_at)
     values ($1,$2,$3)`,
    [customerId, token, expiresAt]
  );

  return { token, expiresAt };
}

export async function POST(req: Request) {
  await ensureIdentityTables();

  const raw: unknown = await req.json().catch(() => null);
  const body: JsonRecord = isRecord(raw) ? raw : {};

  const email = toEmail(body["email"]);
  const locale = toLocale(body["locale"]);
  const ttlMinutes = clampTtlMinutes(body["ttlMinutes"]);

  // Always respond with a generic success message to avoid account enumeration
  if (!email) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const customer = await findCustomerByEmail(email);

  if (customer) {
    const { token, expiresAt } = await createResetToken(customer.id, ttlMinutes);

    const origin = new URL(req.url).origin;
    const resetUrl = `${origin}/${locale}/account/reset-password?token=${token}`;

    // In production, send email (do NOT expose resetUrl).
    if (process.env.NODE_ENV === "production") {
      // If email isn't configured, silently succeed (still no enumeration).
      if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        await sendPasswordResetEmail(customer.email, resetUrl, locale);
      }
    } else {
      // Dev: help you test quickly
      return NextResponse.json({ ok: true, resetUrl, dev: { token, expiresAt } }, { status: 200 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
