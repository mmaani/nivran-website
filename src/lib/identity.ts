import { db } from "@/lib/db";

export async function ensureIdentityTables(): Promise<void> {
  // Customers table
  await db.query(`
    create table if not exists customers (
      id bigserial primary key,
      email text not null unique,
      full_name text,
      password_hash text not null,
      phone text,
      address_line1 text,
      city text,
      country text default 'Jordan',
      email_verified_at timestamptz,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Email verification codes table
  await db.query(`
    create table if not exists customer_email_verification_codes (
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      code text,
      code_hash text,
      salt text,
      expires_at timestamptz,
      used_at timestamptz,
      attempts int default 0,
      created_at timestamptz default now()
    );
  `);

  // --- 🔥 AUTO-HEAL LEGACY SCHEMA ---
  // Add missing columns safely
  await db.query(`alter table customer_email_verification_codes add column if not exists code text;`);
  await db.query(`alter table customer_email_verification_codes add column if not exists code_hash text;`);
  await db.query(`alter table customer_email_verification_codes add column if not exists salt text;`);
  await db.query(`alter table customer_email_verification_codes add column if not exists expires_at timestamptz;`);
  await db.query(`alter table customer_email_verification_codes add column if not exists used_at timestamptz;`);
  await db.query(`alter table customer_email_verification_codes add column if not exists attempts int default 0;`);
  await db.query(`alter table customer_email_verification_codes add column if not exists created_at timestamptz default now();`);

  // Drop NOT NULL from legacy "code" column if it exists
  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='customer_email_verification_codes'
          AND column_name='code'
          AND is_nullable='NO'
      ) THEN
        ALTER TABLE customer_email_verification_codes
        ALTER COLUMN code DROP NOT NULL;
      END IF;
    END $$;
  `);

  // Indexes
  await db.query(`
    create index if not exists customer_email_verification_codes_customer_idx
    on customer_email_verification_codes(customer_id);
  `);
}
