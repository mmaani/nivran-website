-- Nivran patch: variants, tags, promotions targeting, order discount metadata.

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

create unique index if not exists idx_product_variants_single_default on product_variants(product_id) where is_default=true;
create index if not exists idx_product_variants_product on product_variants(product_id);
create index if not exists idx_product_variants_active on product_variants(product_id, is_active);
create index if not exists idx_product_variants_sort on product_variants(product_id, sort_order asc, id asc);

alter table products add column if not exists wear_times text[] not null default '{}'::text[];
alter table products add column if not exists seasons text[] not null default '{}'::text[];
alter table products add column if not exists audiences text[] not null default '{}'::text[];
create index if not exists idx_products_wear_times on products using gin(wear_times);
create index if not exists idx_products_seasons on products using gin(seasons);
create index if not exists idx_products_audiences on products using gin(audiences);

alter table promotions add column if not exists product_slugs text[];
alter table promotions add column if not exists priority integer not null default 0;
create index if not exists idx_promotions_priority on promotions(priority desc);

alter table orders add column if not exists discount_source text;
alter table orders add column if not exists promotion_id bigint;
alter table orders add column if not exists promo_code text;
alter table orders add column if not exists discount_jod numeric(10,2) not null default 0;
