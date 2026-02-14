import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureNewsletterTable() {
  // Create table if missing
  await db.query(`
    create table if not exists newsletter_subscribers (
      id bigserial primary key,
      email text not null,
      locale text not null default 'en',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Migrate older schemas safely
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

  // Deduplicate any legacy duplicates (keep oldest row per email)
  await db.query(`
    delete from newsletter_subscribers a
    using newsletter_subscribers b
    where a.email = b.email
      and a.id > b.id;
  `);

  // Ensure ON CONFLICT(email) works
  await db.query(
    `create unique index if not exists idx_newsletter_email_unique on newsletter_subscribers(email);`
  );
}

function normalizeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readBody(req: Request): Promise<Record<string, any>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const isForm =
    ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");

  if (isForm) {
    const fd = await req.formData();
    const out: Record<string, any> = {};
    for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : v.name;
    return out;
  }

  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function GET() {
  // Prevent “broken page” feeling when someone opens /api/newsletter in the browser
  return NextResponse.json({ ok: true, hint: "POST { email, locale? } to subscribe" }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    await ensureNewsletterTable();

    const body = await readBody(req);
    const email = normalizeEmail(body?.email);
    const locale = String(body?.locale || "en") === "ar" ? "ar" : "en";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    await db.query(
      `
      insert into newsletter_subscribers (email, locale, updated_at)
      values ($1, $2, now())
      on conflict (email)
      do update set
        locale = excluded.locale,
        updated_at = now()
      `,
      [email, locale]
    );

    const ct = req.headers.get("content-type") || "";
    const isForm =
      ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");

    if (isForm) {
      return NextResponse.redirect(new URL(`/${locale}?subscribed=1`, req.url));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("newsletter POST failed", e);
    return NextResponse.json(
      { ok: false, error: "Server error", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
