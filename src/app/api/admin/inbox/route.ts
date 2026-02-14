import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureInboxTables() {
  // --- Contact submissions ---
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
  `);

  // Migrate older schemas safely
  await db.query(`alter table contact_submissions add column if not exists phone text;`);
  await db.query(`alter table contact_submissions add column if not exists locale text not null default 'en';`);
  await db.query(`alter table contact_submissions add column if not exists created_at timestamptz not null default now();`);
  await db.query(`create index if not exists idx_contact_created_at on contact_submissions(created_at desc);`);

  // --- Newsletter subscribers ---
  await db.query(`
    create table if not exists newsletter_subscribers (
      id bigserial primary key,
      email text not null unique,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`alter table newsletter_subscribers add column if not exists locale text not null default 'en';`);
  await db.query(`alter table newsletter_subscribers add column if not exists created_at timestamptz not null default now();`);
  await db.query(`create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at desc);`);

  // --- PayTabs callbacks (optional section) ---
  await db.query(`
    create table if not exists paytabs_callbacks (
      id bigserial primary key,
      cart_id text,
      tran_ref text,
      signature_header text,
      signature_computed text,
      signature_valid boolean not null default false,
      raw_body text,
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`alter table paytabs_callbacks add column if not exists signature_header text;`);
  await db.query(`alter table paytabs_callbacks add column if not exists signature_computed text;`);
  await db.query(`alter table paytabs_callbacks add column if not exists signature_valid boolean not null default false;`);
  await db.query(`alter table paytabs_callbacks add column if not exists raw_body text;`);
  await db.query(`alter table paytabs_callbacks add column if not exists created_at timestamptz not null default now();`);

  await db.query(`create index if not exists idx_paytabs_callbacks_created_at on paytabs_callbacks(created_at desc);`);
  await db.query(`create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id);`);
}

export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token") || "";

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const u = new URL(req.url);
  const limitRaw = u.searchParams.get("limit") || "100";
  const limit = Math.max(10, Math.min(500, Number(limitRaw) || 100));

  try {
    await ensureInboxTables();

    const [contact, subscribers, callbacks] = await Promise.all([
      db.query(
        `select id, name, email, phone, message, locale, created_at
         from contact_submissions
         order by created_at desc
         limit $1`,
        [limit]
      ),
      db.query(
        `select id, email, locale, created_at
         from newsletter_subscribers
         order by created_at desc
         limit $1`,
        [limit]
      ),
      db.query(
        `select id, cart_id, tran_ref, signature_valid, created_at, left(raw_body, 600) as raw_preview
         from paytabs_callbacks
         order by created_at desc
         limit $1`,
        [limit]
      ),
    ]);

    return NextResponse.json(
      { contact: contact.rows, subscribers: subscribers.rows, callbacks: callbacks.rows },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("admin inbox GET failed", e);
    return NextResponse.json({ error: "Server error", detail: e?.message || String(e) }, { status: 500 });
  }
}
