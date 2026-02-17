-- NIVRAN one-go patch: variants, tags, discount metadata and promotion targeting/indexes.
-- Idempotent and safe to run multiple times in Neon.

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

create index if not exists idx_product_variants_product on product_variants(product_id);
create index if not exists idx_product_variants_active on product_variants(product_id, is_active, sort_order asc, id asc);
create unique index if not exists idx_product_variants_one_default_per_product on product_variants(product_id) where is_default=true;

-- Backfill one active default variant per product if missing
insert into product_variants (product_id, label, size_ml, price_jod, compare_at_price_jod, is_default, is_active, sort_order)
select p.id,
       coalesce(nullif(regexp_replace(p.slug, '^.*-([0-9]+ml)$', '\1', 'i'),''), 'Default'),
       null,
       coalesce(p.price_jod, 0),
       p.compare_at_price_jod,
       true,
       true,
       0
from products p
where not exists (
  select 1 from product_variants v where v.product_id=p.id
);

with ranked as (
  select id, product_id, row_number() over (partition by product_id order by is_default desc, is_active desc, sort_order asc, id asc) as rn
  from product_variants
)
update product_variants v
set is_default = (r.rn = 1)
from ranked r
where r.id=v.id;

create table if not exists product_tags (
  product_id bigint primary key references products(id) on delete cascade,
  wear_times text[] not null default '{}',
  seasons text[] not null default '{}',
  audiences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_tags_wear_times on product_tags using gin (wear_times);
create index if not exists idx_product_tags_seasons on product_tags using gin (seasons);
create index if not exists idx_product_tags_audiences on product_tags using gin (audiences);

alter table promotions add column if not exists product_slugs text[];
create index if not exists idx_promotions_product_slugs on promotions using gin(product_slugs);
create index if not exists idx_promotions_category_keys on promotions using gin(category_keys);
create index if not exists idx_promotions_priority_active on promotions(is_active, promo_kind, priority desc);

alter table orders add column if not exists discount_source text;
alter table orders add column if not exists promo_code text;
alter table orders add column if not exists promotion_id bigint;
alter table orders add column if not exists discount_jod numeric(10,2) not null default 0;

