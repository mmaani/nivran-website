// src/lib/catalog.ts
import { db } from "@/lib/db";

/**
 * Migration-safe catalog schema.
 * - Works even if tables already exist with missing columns
 * - Backfills slug + dedupes before enforcing uniqueness
 * - Creates indexes only after columns exist
 */
export async function ensureCatalogTables() {
  // Base tables (minimal, so create always succeeds)
  await db.query(`
    create table if not exists products (
      id bigserial primary key
    );
  `);

  await db.query(`
    create table if not exists promotions (
      id bigserial primary key
    );
  `);

  // ---------- PRODUCTS: columns ----------
  await db.query(`alter table products add column if not exists slug text;`);
  await db.query(`alter table products add column if not exists name_en text;`);
  await db.query(`alter table products add column if not exists name_ar text;`);
  await db.query(`alter table products add column if not exists description_en text;`);
  await db.query(`alter table products add column if not exists description_ar text;`);
  await db.query(`alter table products add column if not exists price_jod numeric(10,2);`);
  await db.query(`alter table products add column if not exists compare_at_price_jod numeric(10,2);`);
  await db.query(`alter table products add column if not exists inventory_qty integer not null default 0;`);
  await db.query(`alter table products add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table products add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table products add column if not exists updated_at timestamptz not null default now();`);

  // Backfill slug if blank/null (unique by appending id)
  await db.query(`
    update products
    set slug = (
      coalesce(
        nullif(
          regexp_replace(
            regexp_replace(
              lower(coalesce(name_en, 'product')),
              '[^a-z0-9]+', '-', 'g'
            ),
            '(^-+|-+$)', '', 'g'
          ),
          ''
        ),
        'product'
      ) || '-' || id::text
    )
    where slug is null or slug = '';
  `);

  // Deduplicate any existing duplicate slugs (make them unique using id suffix)
  await db.query(`
    with d as (
      select slug
      from products
      where slug is not null and slug <> ''
      group by slug
      having count(*) > 1
    )
    update products p
    set slug = p.slug || '-' || p.id::text
    from d
    where p.slug = d.slug;
  `);

  // Enforce NOT NULL slug (safe after backfill)
  await db.query(`alter table products alter column slug set not null;`);

  // ---------- PROMOTIONS: columns ----------
  await db.query(`alter table promotions add column if not exists code text;`);
  await db.query(`alter table promotions add column if not exists title_en text;`);
  await db.query(`alter table promotions add column if not exists title_ar text;`);
  await db.query(`alter table promotions add column if not exists discount_type text;`);
  await db.query(`alter table promotions add column if not exists discount_value numeric(10,2);`);
  await db.query(`alter table promotions add column if not exists starts_at timestamptz;`);
  await db.query(`alter table promotions add column if not exists ends_at timestamptz;`);
  await db.query(`alter table promotions add column if not exists usage_limit integer;`);
  await db.query(`alter table promotions add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table promotions add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table promotions add column if not exists updated_at timestamptz not null default now();`);

  // Deduplicate promo codes if any duplicates exist (rare, but prevents unique index failure)
  await db.query(`
    with d as (
      select code
      from promotions
      where code is not null and code <> ''
      group by code
      having count(*) > 1
    )
    update promotions p
    set code = p.code || '-' || p.id::text
    from d
    where p.code = d.code;
  `);

  // ---------- Indexes (last) ----------
  await db.query(`create unique index if not exists idx_products_slug_unique on products(slug);`);
  await db.query(`create index if not exists idx_products_active on products(is_active);`);
  await db.query(`create index if not exists idx_products_created_at on products(created_at desc);`);

  await db.query(`create unique index if not exists idx_promotions_code_unique on promotions(code);`);
  await db.query(`create index if not exists idx_promotions_active on promotions(is_active);`);
  await db.query(`create index if not exists idx_promotions_created_at on promotions(created_at desc);`);
}
