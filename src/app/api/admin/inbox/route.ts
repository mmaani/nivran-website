// src/app/api/admin/inbox/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;

  // NEW (from updated contact form)
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

  // in your real schema
  verified: boolean;
  signature_valid: boolean;

  received_at: string;
  raw_preview: string | null;
};

async function ensureInboxTables() {
  // Create missing tables (your DB does NOT have these yet)
  await db.query(`
    create table if not exists contact_submissions (
      id bigserial primary key,
      name text not null,
      email text not null,
      phone text,
      topic text,
      subject text,
      order_ref text,
      message text not null,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );

    create table if not exists newsletter_subscribers (
      id bigserial primary key,
      email text not null unique,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );
  `);

  // Safe migrations if table already exists but columns don’t
  await db.query(`alter table contact_submissions add column if not exists topic text;`);
  await db.query(`alter table contact_submissions add column if not exists subject text;`);
  await db.query(`alter table contact_submissions add column if not exists order_ref text;`);

  // Indexes
  await db.query(`create index if not exists idx_contact_created_at on contact_submissions(created_at desc);`);
  await db.query(`create index if not exists idx_contact_topic on contact_submissions(topic);`);
  await db.query(`create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at desc);`);
}

export async function GET(req: Request): Promise<Response> {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  await ensureInboxTables();

  const u = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(u.searchParams.get("limit") || "100") || 100));

  const [contact, subs, callbacks] = await Promise.all([
    db.query<ContactRow>(
      `select
         id,
         name,
         email,
         phone,
         topic,
         subject,
         order_ref,
         message,
         locale,
         created_at::text
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
    // IMPORTANT: match YOUR DB schema exactly
    db.query<CallbackRow>(
      `select
         id,
         cart_id,
         tran_ref,
         verified,
         signature_valid,
         received_at::text,
         left(coalesce(payload::text, ''), 500) as raw_preview
       from paytabs_callbacks
       order by received_at desc
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
