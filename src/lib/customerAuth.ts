import crypto from "crypto";
import { db } from "@/lib/db";

function parseCookie(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/**
 * Tries multiple cookie names, and matches against customer_sessions.token or token_hash.
 * Returns customer_id if session is valid and not revoked/expired.
 */
export async function getCustomerIdFromRequest(req: Request): Promise<number | null> {
  const cookies = parseCookie(req.headers.get("cookie"));

  const candidates = [
    cookies["customer_session"],
    cookies["session"],
    cookies["token"],
    cookies["auth_token"],
  ].filter(Boolean) as string[];

  // Also allow Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) candidates.unshift(m[1].trim());

  if (!candidates.length) return null;

  // Try direct match first
  for (const tok of candidates) {
    const r = await db.query<{ customer_id: number }>(
      `select customer_id
         from customer_sessions
        where revoked_at is null
          and expires_at > now()
          and (token=$1 or token_hash=$1)
        limit 1`,
      [tok]
    );
    if (r.rows[0]?.customer_id) return Number(r.rows[0].customer_id);
  }

  // Try hashed token match (in case only token_hash is stored)
  for (const tok of candidates) {
    const hashed = sha256Hex(tok);
    const r = await db.query<{ customer_id: number }>(
      `select customer_id
         from customer_sessions
        where revoked_at is null
          and expires_at > now()
          and token_hash=$1
        limit 1`,
      [hashed]
    );
    if (r.rows[0]?.customer_id) return Number(r.rows[0].customer_id);
  }

  return null;
}
