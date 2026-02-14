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

async function ensureInboxTables() {
  await db.query(`
    create table if not exists contact_submissions (
      id bigserial primary key,
      name text not null,
      email text not null,
      phone text,
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

    create table if not exists paytabs_callbacks (
      id bigserial primary key,
      cart_id text,
      tran_ref text,
      signature_valid boolean not null default false,
      payload_json jsonb,
      created_at timestamptz not null default now()
    );
  `);

  // Optional columns / safe migrations
  await db.query(`alter table newsletter_subscribers add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table paytabs_callbacks add column if not exists payload_json jsonb;`);

  await db.query(`create index if not exists idx_contact_created_at on contact_submissions(created_at);`);
  await db.query(`create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at);`);
  await db.query(`create index if not exists idx_paytabs_callbacks_created_at on paytabs_callbacks(created_at);`);
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
    db.query<CallbackRow>(
      `select id,
              cart_id,
              tran_ref,
              signature_valid,
              created_at::text,
              left(coalesce(payload_json::text,''), 500) as raw_preview
       from paytabs_callbacks
       order by created_at desc
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
