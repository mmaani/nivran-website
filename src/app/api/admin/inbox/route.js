import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureInboxTables } from "@/lib/inbox";

export const runtime = "nodejs";

export async function GET(req) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  await ensureInboxTables();

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "100");
  const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));

  const [contact, subs] = await Promise.all([
    db.query(
      `select id, name, email, phone, message, locale, created_at
       from contact_submissions
       order by created_at desc
       limit $1`,
      [limit]
    ),
    db.query(
      `select id, email, locale, created_at, updated_at
       from newsletter_subscribers
       order by coalesce(updated_at, created_at) desc
       limit $1`,
      [limit]
    ),
  ]);

  return NextResponse.json({ ok: true, contact: contact.rows, subscribers: subs.rows });
}
