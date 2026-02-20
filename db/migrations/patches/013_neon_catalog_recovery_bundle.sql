-- 013_neon_catalog_recovery_bundle.sql
-- Consolidated, idempotent Neon SQL bundle for catalog/shipping resilience fixes.

begin;

-- Ensure settings table exists and default threshold is aligned to 69 JOD.
create table if not exists store_settings (
  key text primary key,
  value_text text,
  value_number numeric(10,2),
  updated_at timestamptz not null default now()
);

insert into store_settings (key, value_number, updated_at)
values ('free_shipping_threshold_jod', 69, now())
on conflict (key) do update
set value_number = coalesce(store_settings.value_number, excluded.value_number),
    updated_at = now();

-- Upgrade older/null defaults to 69 while preserving merchant custom values.
update store_settings
set value_number = 69,
    updated_at = now()
where key = 'free_shipping_threshold_jod'
  and (value_number is null or value_number = 35);

-- Ensure core catalog tables used by /en/product reads exist.
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

create table if not exists products (
  id bigserial primary key,
  slug text,
  slug_en text,
  slug_ar text,
  name_en text,
  name_ar text,
  description_en text,
  description_ar text,
  price_jod numeric(10,2),
  compare_at_price_jod numeric(10,2),
  inventory_qty integer not null default 0,
  category_key text default 'perfume',
  wear_times text[] not null default '{}'::text[],
  seasons text[] not null default '{}'::text[],
  audiences text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_images (
  id bigserial primary key,
  product_id bigint not null,
  "position" integer not null default 0,
  filename text,
  content_type text not null default 'image/jpeg',
  bytes bytea,
  created_at timestamptz not null default now()
);

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

create table if not exists promotions (
  id bigserial primary key,
  promo_kind text not null default 'PROMO',
  code text,
  title_en text,
  title_ar text,
  discount_type text,
  discount_value numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  min_order_jod numeric(10,2),
  priority integer not null default 0,
  used_count integer not null default 0,
  category_keys text[],
  product_slugs text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_products_slug_unique on products(slug);
create index if not exists idx_products_active on products(is_active);
create index if not exists idx_products_created_at on products(created_at desc);
create index if not exists idx_product_images_product on product_images(product_id, "position");
create index if not exists idx_product_variants_product on product_variants(product_id);
create index if not exists idx_promotions_active on promotions(is_active);
create index if not exists idx_promotions_kind on promotions(promo_kind);

commit;
