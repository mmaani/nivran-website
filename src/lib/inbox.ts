import { db } from "@/lib/db";

export async function ensureInboxTables() {
  await db.query(`
    create table if not exists contact_submissions (
      id bigserial primary key
    );
  `);

  await db.query(`alter table contact_submissions add column if not exists name text not null default ''`);
  await db.query(`alter table contact_submissions add column if not exists email text not null default ''`);
  await db.query(`alter table contact_submissions add column if not exists phone text`);
  await db.query(`alter table contact_submissions add column if not exists message text not null default ''`);
  await db.query(`alter table contact_submissions add column if not exists locale text not null default 'en'`);
  await db.query(`alter table contact_submissions add column if not exists created_at timestamptz not null default now()`);

  await db.query(`create index if not exists idx_contact_created_at on contact_submissions(created_at desc)`);
  await db.query(`create index if not exists idx_contact_email on contact_submissions(email)`);

  await db.query(`
    create table if not exists newsletter_subscribers (
      id bigserial primary key
    );
  `);

  await db.query(`alter table newsletter_subscribers add column if not exists email text`);
  await db.query(`alter table newsletter_subscribers add column if not exists locale text not null default 'en'`);
  await db.query(`alter table newsletter_subscribers add column if not exists created_at timestamptz not null default now()`);
  await db.query(`alter table newsletter_subscribers add column if not exists updated_at timestamptz`);

  // Ensure uniqueness (needed for INSERT ... ON CONFLICT)
  await db.query(`create unique index if not exists ux_newsletter_email on newsletter_subscribers(email)`);
  await db.query(`create index if not exists idx_newsletter_updated on newsletter_subscribers(updated_at desc)`);
}
