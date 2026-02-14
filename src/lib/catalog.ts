// src/lib/catalog.ts
import { db } from "@/lib/db";

/**
 * Ensure catalog tables exist + are migrated safely (idempotent).
 * - Works even if tables were created previously with missing columns
 * - Avoids multi-statement queries for maximum driver compatibility
 */
export async function ensureCatalogTables() {
  // 1) Create base tables (only if missing)
  await db.query(`
    create table if not exists products (
      id bigserial primary key,
      slug text not null unique,
      name_en text not null,
      name_ar text not null,
      description_en text,
      description_ar text,
      price_jod numeric(10,2) not null,
      compare_at_price_jod numeric(10,2),
      inventory_qty integer not null default 0
    );
  `);

  await db.query(`
    create table if not exists promotions (
      id bigserial primary key,
      code text not null unique,
      title_en text not null,
      title_ar text not null,
      discount_type text not null check (discount_type in ('PERCENT','FIXED')),
      discount_value numeric(10,2) not null,
      starts_at timestamptz,
      ends_at timestamptz,
      usage_limit integer
    );
  `);

  // 2) Migrate: add missing columns for older DBs
  await db.query(`alter table products add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table products add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table products add column if not exists updated_at timestamptz not null default now();`);

  await db.query(`alter table promotions add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table promotions add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table promotions add column if not exists updated_at timestamptz not null default now();`);

  // 3) Indexes last (depends on columns existing)
  await db.query(`create index if not exists idx_products_active on products(is_active);`);
  await db.query(`create index if not exists idx_promotions_active on promotions(is_active);`);

  // (Optional but useful for admin pages)
  await db.query(`create index if not exists idx_products_created_at on products(created_at desc);`);
  await db.query(`create index if not exists idx_promotions_created_at on promotions(created_at desc);`);
}
