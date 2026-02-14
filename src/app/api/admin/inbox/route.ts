// src/app/api/admin/inbox/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureInboxTables } from "@/lib/inbox";
import { ensureOrdersTables } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
  created_at: string;
};

type SubscriberRow = {
  id: number;
  email: string;
  locale: string;
  created_at: string;
};

type CallbackRow = {
  id: number;
  cart_id: string | null;
  tran_ref: string | null;
  signature_valid: boolean;
  created_at: string;
  raw_preview: string | null;
};

export async function GET(req: Request) {
  // Auth (cookie-based admin session)
  const denied = await requireAdmin(req);
  if (denied) return denied;

  // Make sure tables exist (safe migrations)
  await Promise.all([ensureInboxTables(), ensureOrdersTables()]);

  const url = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(url.searchParams.get("limit") || 100)));

  const [contact, subs, callbacks] = await Promise.all([
    db.query<ContactRow>(
      `select id, name, email, phone, message, locale, created_at::text
       from contact_submissions
       order by created_at desc
       limit $1`,
      [limit]
    ),
    db.query<SubscriberRow>(
      `select id, email, locale, created_at::text
       from newsletter_subscribers
       order by created_at desc
       limit $1`,
      [limit]
    ),
    (async () => {
      // support either raw_body or payload (older schema)
      const r = await db.query<{ ok: number }>(
        `select 1 as ok
         from information_schema.columns
         where table_name='paytabs_callbacks' and column_name='payload'
         limit 1`
      );
      const hasPayload = (r.rowCount ?? 0) > 0;
      const bodyCol = hasPayload ? "payload" : "raw_body";

      return db.query<CallbackRow>(
        `select
            id,
            cart_id,
            tran_ref,
            signature_valid,
            created_at::text,
            nullif(left(coalesce(${bodyCol}, ''), 220), '') as raw_preview
         from paytabs_callbacks
         order by created_at desc
         limit $1`,
        [limit]
      );
    })(),
  ]);

  return NextResponse.json({
    ok: true,
    contact: contact.rows,
    subscribers: subs.rows,
    callbacks: callbacks.rows,
  });
}
