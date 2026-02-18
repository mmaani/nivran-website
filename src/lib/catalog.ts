import "server-only";
// src/lib/catalog.ts
import { db } from "@/lib/db";

/**
 * Catalog schema helpers (migration-safe).
 *
 * Goals:
 * - Products are managed from /admin/catalog (not hardcoded in siteContent)
 * - Each product has a category_key (perfume / hand-gel / cream / air-freshener / soap)
 * - Up to 5 images per product are stored in Postgres (bytea) via product_images
 * - Promotions can target one or more categories via promotions.category_keys (text[])
 */
export async function ensureCatalogTables() {
  // ---------- PRODUCTS ----------
  // Create minimal base table if missing (keeps initial boot robust).
  await db.query(`
    create table if not exists products (
      id bigserial primary key
    );
  `);

  // Core product fields used by the app
  await db.query(`alter table products add column if not exists slug text;`);
  await db.query(`alter table products add column if not exists slug_en text;`);
  await db.query(`alter table products add column if not exists slug_ar text;`);
  await db.query(`alter table products add column if not exists name_en text;`);
  await db.query(`alter table products add column if not exists name_ar text;`);
  await db.query(`alter table products add column if not exists description_en text;`);
  await db.query(`alter table products add column if not exists description_ar text;`);
  await db.query(`alter table products add column if not exists price_jod numeric(10,2);`);
  await db.query(`alter table products add column if not exists compare_at_price_jod numeric(10,2);`);
  await db.query(`alter table products add column if not exists inventory_qty integer not null default 0;`);
  await db.query(`alter table products add column if not exists category_key text default 'perfume';`);
  await db.query(`alter table products add column if not exists wear_times text[] not null default '{}'::text[];`);
  await db.query(`alter table products add column if not exists seasons text[] not null default '{}'::text[];`);
  await db.query(`alter table products add column if not exists audiences text[] not null default '{}'::text[];`);
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

  // Backfill language slugs if missing.
  await db.query(`
    update products
    set
      slug_en = coalesce(nullif(slug_en,''), slug),
      slug_ar = coalesce(nullif(slug_ar,''), slug)
    where slug is not null and (slug_en is null or slug_en='' or slug_ar is null or slug_ar='');
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

  // ---------- CATEGORIES ----------
  await db.query(`
    create table if not exists categories (
      key text primary key,
      name_en text not null,
      name_ar text not null,
      sort_order integer not null default 0,
      is_active boolean not null default true,
      is_promoted boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Seed your default category set (only if missing; does not overwrite edits)
  await db.query(`
    insert into categories (key, name_en, name_ar, sort_order, is_active, is_promoted)
    values
      ('perfume', 'Perfume', 'عطر', 10, true, true),
      ('hand-gel', 'Hand Gel', 'معقم يدين', 20, true, true),
      ('cream', 'Cream', 'كريم', 30, true, true),
      ('air-freshener', 'Air Freshener', 'معطر جو', 40, true, true),
      ('soap', 'Soap', 'صابون', 50, true, true)
    on conflict (key) do nothing;
  `);

  // ---------- PROMOTIONS ----------
  await db.query(`
    create table if not exists promotions (
      id bigserial primary key
    );
  `);

  await db.query(`alter table promotions add column if not exists promo_kind text not null default 'CODE';`);
  await db.query(`alter table promotions add column if not exists code text;`);
  await db.query(`alter table promotions add column if not exists title_en text;`);
  await db.query(`alter table promotions add column if not exists title_ar text;`);
  await db.query(`alter table promotions add column if not exists discount_type text;`);
  await db.query(`alter table promotions add column if not exists discount_value numeric(10,2);`);
  await db.query(`alter table promotions add column if not exists starts_at timestamptz;`);
  await db.query(`alter table promotions add column if not exists ends_at timestamptz;`);
  await db.query(`alter table promotions add column if not exists usage_limit integer;`);
  await db.query(`alter table promotions add column if not exists min_order_jod numeric(10,2);`);
  await db.query(`alter table promotions add column if not exists priority integer not null default 0;`);
  await db.query(`alter table promotions add column if not exists used_count integer not null default 0;`);
  await db.query(`alter table promotions add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table promotions add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table promotions add column if not exists updated_at timestamptz not null default now();`);

  // NEW: target promotions to categories and specific product slugs (optional)
  await db.query(`alter table promotions add column if not exists category_keys text[];`);
  await db.query(`alter table promotions add column if not exists product_slugs text[];`);


  await db.query(`
    do $$
    begin
      begin
        alter table promotions alter column code drop not null;
      exception when others then
        null;
      end;
    end $$;
  `);
  // Deduplicate promo codes (prevents unique index failure)
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


  await db.query(`
    update promotions
       set promo_kind = case when nullif(code,'') is null then 'AUTO' else 'CODE' end
     where promo_kind is null or promo_kind not in ('AUTO','CODE')
  `);

  await db.query(`
    do $$
    begin
      if not exists (
        select 1 from pg_constraint where conname='promotions_kind_code_chk'
      ) then
        alter table promotions
          add constraint promotions_kind_code_chk
          check (
            (promo_kind='AUTO' and (code is null or btrim(code)=''))
            or (promo_kind='CODE' and code is not null and btrim(code) <> '')
          );
      end if;
    end $$;
  `);
  // ---------- PRODUCT IMAGES (bytea in Postgres) ----------
  await db.query(`
    create table if not exists product_images (
      id bigserial primary key,
      product_id bigint not null,
      "position" integer not null default 0,
      filename text,
      content_type text not null,
      bytes bytea not null,
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`
    create table if not exists product_variants (
      id bigserial primary key,
      product_id bigint not null references products(id) on delete cascade,
      label text not null,
      size_ml integer,
      price_jod numeric(10,2) not null,
      compare_at_price_jod numeric(10,2),
      is_default boolean not null default false,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await db.query(`create unique index if not exists idx_product_variants_single_default on product_variants(product_id) where is_default=true;`);

  // ---------- Indexes (last) ----------
  await db.query(`create unique index if not exists idx_products_slug_unique on products(slug);`);
  await db.query(`create index if not exists idx_products_active on products(is_active);`);
  await db.query(`create index if not exists idx_products_category on products(category_key);`);
  await db.query(`create index if not exists idx_products_created_at on products(created_at desc);`);
  await db.query(`create index if not exists idx_products_wear_times on products using gin(wear_times);`);
  await db.query(`create index if not exists idx_products_seasons on products using gin(seasons);`);
  await db.query(`create index if not exists idx_products_audiences on products using gin(audiences);`);

  await db.query(`create unique index if not exists idx_categories_key_unique on categories(key);`);
  await db.query(`create index if not exists idx_categories_active on categories(is_active);`);
  await db.query(`create index if not exists idx_categories_sort on categories(sort_order asc);`);

  await db.query(`drop index if exists idx_promotions_code_unique`);
  await db.query(`create unique index if not exists idx_promotions_code_unique on promotions(code) where promo_kind='CODE';`);
  await db.query(`create index if not exists idx_promotions_active on promotions(is_active);`);
  await db.query(`create index if not exists idx_promotions_kind on promotions(promo_kind);`);
  await db.query(`create index if not exists idx_promotions_created_at on promotions(created_at desc);`);
  await db.query(`create index if not exists idx_promotions_usage on promotions(usage_limit, used_count);`);
  await db.query(`create index if not exists idx_promotions_priority on promotions(priority desc);`);

  await db.query(`create index if not exists idx_product_images_product on product_images(product_id, "position");`);
  await db.query(`create index if not exists idx_product_variants_product on product_variants(product_id);`);
  await db.query(`create index if not exists idx_product_variants_active on product_variants(product_id, is_active);`);
  await db.query(`create index if not exists idx_product_variants_sort on product_variants(product_id, sort_order asc, id asc);`);
}


function errorCodeOf(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : "";
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return String(error.message || "");
  return String(error || "");
}

export function isRecoverableCatalogSetupError(error: unknown): boolean {
  const code = errorCodeOf(error);
  const message = errorMessageOf(error).toLowerCase();

  if (code === "42501" || code === "25006" || code === "28P01") return true; // permission denied, read-only, auth

  return (
    message.includes("permission denied")
    || message.includes("must be owner")
    || message.includes("read-only")
    || message.includes("cannot execute")
  );
}

export async function ensureCatalogTablesSafe(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await ensureCatalogTables();
    return { ok: true };
  } catch (error: unknown) {
    if (isRecoverableCatalogSetupError(error)) {
      const reason = errorMessageOf(error).slice(0, 180);
      console.warn(`[catalog] ensureCatalogTables skipped: ${reason}`);
      return { ok: false, reason };
    }
    throw error;
  }
}
