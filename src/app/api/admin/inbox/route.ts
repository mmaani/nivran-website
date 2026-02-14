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

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  await ensureInboxTables();
  await ensureOrdersTables();

  const u = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(u.searchParams.get("limit") || "100") || 100));

  const [contactRes, subsRes, cbRes] = await Promise.all([
    db.query<ContactRow>(
      `select id, name, email, phone, message, locale, created_at::text
       from contact_messages
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
    db.query<CallbackRow>(
      `select id,
              cart_id,
              tran_ref,
              signature_valid,
              created_at::text,
              left(coalesce(raw_body,''), 600) as raw_preview
       from paytabs_callbacks
       order by created_at desc
       limit $1`,
      [limit]
    ),
  ]);

  return NextResponse.json({
    ok: true,
    contact: contactRes.rows,
    subscribers: subsRes.rows,
    callbacks: cbRes.rows,
  });
}
