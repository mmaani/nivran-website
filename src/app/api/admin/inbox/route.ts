import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureInboxTables } from "@/lib/inbox";
import { hasColumn } from "@/lib/dbSchema";
import { ensureOrdersTables } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  topic: string | null;
  subject: string | null;
  order_ref: string | null;
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
  verified: boolean;
  signature_valid: boolean;
  received_at: string;
  raw_preview: string | null;
};

export async function GET(req: Request): Promise<Response> {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  await Promise.all([ensureInboxTables(), ensureOrdersTables()]);

  const hasVerified = await hasColumn("paytabs_callbacks", "verified");
  const hasReceivedAt = await hasColumn("paytabs_callbacks", "received_at");

  const verifiedSelect = hasVerified ? "verified" : "signature_valid as verified";
  const receivedAtSelect = hasReceivedAt ? "received_at" : "created_at";

  const u = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(u.searchParams.get("limit") || "100") || 100));

  const [contact, subs, callbacks] = await Promise.all([
    db.query<ContactRow>(
      `select id, name, email, phone, topic, subject, order_ref, message, locale, created_at::text
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
    db.query<CallbackRow>(
      `select id, cart_id, tran_ref, ${verifiedSelect}, signature_valid, ${receivedAtSelect}::text as received_at,
              left(coalesce(payload::text, raw_body, ''), 500) as raw_preview
         from paytabs_callbacks
        order by ${receivedAtSelect} desc
        limit $1`,
      [limit]
    ),
  ]);

  return NextResponse.json({
    ok: true,
    contact: contact.rows,
    subscribers: subs.rows,
    callbacks: callbacks.rows,
  });
}
