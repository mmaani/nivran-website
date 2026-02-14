// src/app/api/admin/inbox/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureInboxTables } from "@/lib/inbox";
import { ensureOrdersTables } from "@/lib/orders";
import { requireAdmin } from "@/lib/guards";

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

let _hasPayloadCol: boolean | null = null;

async function hasPayloadColumn(): Promise<boolean> {
  if (_hasPayloadCol !== null) return _hasPayloadCol;

  const r = await db.query<{ exists: number }>(
    `select 1 as exists
     from information_schema.columns
     where table_name='paytabs_callbacks' and column_name='payload'
     limit 1`
  );
  _hasPayloadCol = (r.rowCount ?? 0) > 0;
  return _hasPayloadCol;
}

export async function GET(req: Request): Promise<Response> {
  // ✅ Always return Response / NextResponse (never plain objects)
  const auth = requireAdmin(req);
  if (!auth.ok) {
return NextResponse.json(auth, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(url.searchParams.get("limit") || 100)));

  try {
    await Promise.all([ensureInboxTables(), ensureOrdersTables()]);

    const [contactRes, subsRes] = await Promise.all([
      db.query<ContactRow>(
        `select id, name, email, phone, message, locale, created_at::text as created_at
         from contact_submissions
         order by created_at desc
         limit $1`,
        [limit]
      ),
      db.query<SubscriberRow>(
        `select id, email, locale, created_at::text as created_at
         from newsletter_subscribers
         order by created_at desc
         limit $1`,
        [limit]
      ),
    ]);

    const payloadCol = await hasPayloadColumn();

    const callbacksRes = payloadCol
      ? await db.query<CallbackRow>(
          `select id, cart_id, tran_ref, signature_valid, created_at::text as created_at,
                  left(coalesce(payload::text,''), 900) as raw_preview
           from paytabs_callbacks
           order by created_at desc
           limit $1`,
          [limit]
        )
      : await db.query<CallbackRow>(
          `select id, cart_id, tran_ref, signature_valid, created_at::text as created_at,
                  left(coalesce(raw_body,''), 900) as raw_preview
           from paytabs_callbacks
           order by created_at desc
           limit $1`,
          [limit]
        );

    return NextResponse.json(
      {
        ok: true,
        contact: contactRes.rows,
        subscribers: subsRes.rows,
        callbacks: callbacksRes.rows,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load inbox" },
      { status: 500 }
    );
  }
}
