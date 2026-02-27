import "server-only";
import { db } from "@/lib/db";

export async function ensureInboxTables() {
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

  await db.query(`alter table contact_submissions add column if not exists topic text`);
  await db.query(`alter table contact_submissions add column if not exists subject text`);
  await db.query(`alter table contact_submissions add column if not exists order_ref text`);

  await db.query(`create index if not exists idx_contact_created_at on contact_submissions(created_at desc)`);
  await db.query(`create index if not exists idx_contact_email on contact_submissions(email)`);
  await db.query(`create index if not exists idx_contact_topic on contact_submissions(topic)`);

  await db.query(`
    create table if not exists newsletter_subscribers (
      id bigserial primary key,
      email text
    );
  `);

  await db.query(`alter table newsletter_subscribers add column if not exists locale text not null default 'en'`);
  await db.query(`alter table newsletter_subscribers add column if not exists created_at timestamptz not null default now()`);
  await db.query(`alter table newsletter_subscribers add column if not exists updated_at timestamptz`);

  await db.query(`create unique index if not exists ux_newsletter_email on newsletter_subscribers(email)`);
  await db.query(`create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at desc)`);
  await db.query(`create index if not exists idx_newsletter_updated on newsletter_subscribers(updated_at desc)`);
}


export async function ensureInboxTablesSafe(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await ensureInboxTables();
    return { ok: true };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error || "UNKNOWN_INBOX_BOOTSTRAP_ERROR");
    const ddlBlocked = /permission denied|must be owner|read-only|readonly|cannot execute|not authorized|ddl/i.test(reason);

    if (ddlBlocked) {
      try {
        await db.query(`select 1 from contact_submissions limit 1`);
        await db.query(`select 1 from newsletter_subscribers limit 1`);
        console.warn("[inbox] ensureInboxTables skipped (DDL blocked), but required tables exist; proceeding read-only.");
        return { ok: false, reason: "DDL_BLOCKED_EXISTING_TABLES" };
      } catch {
        console.warn(`[inbox] ensureInboxTables skipped and required tables missing: ${reason}`);
      }
    }

    throw error;
  }
}
