import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { ensureIdentityTables } from "@/lib/identity";

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

async function customerExists(email: string): Promise<boolean> {
  const r = await db.query<{ ok: number }>(
    `select 1 as ok from customers where lower(email)=lower($1) limit 1`,
    [email]
  );
  return !!r.rows[0];
}

async function createResetToken(email: string, ttlMinutes: number): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await db.query(
    `insert into password_reset_tokens (email, token, expires_at)
     values ($1,$2,$3)`,
    [email, token, expiresAt]
  );

  return { token, expiresAt };
}

export async function POST(req: Request) {
  await ensureIdentityTables();

  const raw: unknown = await req.json().catch(() => null);
  const body: JsonRecord = isRecord(raw) ? raw : {};

  const email = toEmail(body["email"]);
  const ttlMinutes = clampTtlMinutes(body["ttlMinutes"]);

  // Always respond with a generic success message to avoid account enumeration
  if (!email) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Only create token if the customer exists
  if (await customerExists(email)) {
    const { token, expiresAt } = await createResetToken(email, ttlMinutes);

    // If you don’t have email sending yet, exposing the token in production is unsafe.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, dev: { token, expiresAt } }, { status: 200 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
