import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { ensureIdentityTables, hashPassword, sha256Hex } from "@/lib/identity";
import { getClientIp, rateLimitCheck } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureIdentityTables();
  const clientIp = getClientIp(req);
  const limit = await rateLimitCheck({
    key: `reset:${clientIp}`,
    action: "auth_reset_password",
    windowSeconds: 15 * 60,
    maxInWindow: 15,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many reset attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = String(body?.token || "").trim();
  const password = String(body?.password || "");

  if (!token) return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 chars" }, { status: 400 });
  }

  const hasTokenHash = await hasColumn("customer_password_reset_tokens", "token_hash");
  const tokenHash = sha256Hex(token);
  const { rows } = await db.query<{ id: number; customer_id: number }>(
    hasTokenHash
      ? `select id, customer_id
         from customer_password_reset_tokens
         where (token_hash=$1 or (token_hash is null and token=$2))
           and used_at is null and expires_at > now()
         order by id desc
         limit 1`
      : `select id, customer_id
         from customer_password_reset_tokens
         where token=$1 and used_at is null and expires_at > now()
         order by id desc
         limit 1`,
    hasTokenHash ? [tokenHash, token] : [token]
  );

  const row = rows[0];
  if (!row) return NextResponse.json({ ok: false, error: "Invalid or expired token" }, { status: 400 });

  await db.query(`update customers set password_hash=$2, updated_at=now() where id=$1`, [row.customer_id, await hashPassword(password)]);
  await db.query(`update customer_password_reset_tokens set used_at=now() where id=$1`, [row.id]);
  await db.query(`update customer_sessions set revoked_at=now() where customer_id=$1`, [row.customer_id]);

  return NextResponse.json({ ok: true });
}
