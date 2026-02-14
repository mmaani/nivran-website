import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureNewsletterTable() {
  // Create base table (if missing)
  await db.query(`
    create table if not exists newsletter_subscribers (
      id bigserial primary key,
      email text not null,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );
  `);

  // Migrate missing columns
  await db.query(`alter table newsletter_subscribers add column if not exists email text;`);
  await db.query(
    `alter table newsletter_subscribers add column if not exists locale text not null default 'en';`
  );
  await db.query(
    `alter table newsletter_subscribers add column if not exists created_at timestamptz not null default now();`
  );
  await db.query(
    `alter table newsletter_subscribers add column if not exists updated_at timestamptz not null default now();`
  );

  // Deduplicate (keep lowest id per email)
  await db.query(`
    delete from newsletter_subscribers a
    using newsletter_subscribers b
    where a.email = b.email
      and a.id > b.id;
  `);

  // Indexes
  await db.query(`create unique index if not exists idx_newsletter_email_unique on newsletter_subscribers(email);`);
  await db.query(`create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at desc);`);
}

async function readBody(req) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }

  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const fd = await req.formData();
      const out = {};
      for (const [k, v] of fd.entries()) out[k] = String(v);
      return out;
    } catch {
      return {};
    }
  }

  // fallback
  try {
    const text = (await req.text())?.trim();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { email: text };
    }
  } catch {
    return {};
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, hint: "POST { email, locale? } to subscribe" },
    { status: 200 }
  );
}

export async function POST(req) {
  try {
    await ensureNewsletterTable();

    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const locale = String(body.locale || "en").slice(0, 8);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const r = await db.query(
      `
      insert into newsletter_subscribers (email, locale, updated_at)
      values ($1, $2, now())
      on conflict (email)
      do update set
        locale = excluded.locale,
        updated_at = now()
      returning id, email, locale, created_at, updated_at
      `,
      [email, locale]
    );

    return NextResponse.json({ ok: true, subscriber: r.rows[0] }, { status: 200 });
  } catch (e) {
    console.error("newsletter POST failed", e);
    return NextResponse.json(
      { ok: false, error: "Server error", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
