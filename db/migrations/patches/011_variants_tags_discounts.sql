-- idempotent patch: variants + tags + discount persistence hardening
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

alter table products add column if not exists wear_times text[];
alter table products add column if not exists seasons text[];
alter table products add column if not exists audiences text[];

create index if not exists idx_variants_product on product_variants(product_id);
create index if not exists idx_variants_active_default on product_variants(product_id, is_active, is_default);
create unique index if not exists idx_variants_one_default_per_product on product_variants(product_id) where is_default=true;
create index if not exists idx_products_tags_wear_times on products using gin(wear_times);
create index if not exists idx_products_tags_seasons on products using gin(seasons);
create index if not exists idx_products_tags_audiences on products using gin(audiences);

alter table promotions add column if not exists product_slugs text[];
alter table orders add column if not exists discount_source text;
alter table orders add column if not exists promo_code text;
alter table orders add column if not exists promotion_id bigint references promotions(id);
alter table orders add column if not exists discount_jod numeric(10,2) not null default 0;

with missing as (
  select p.id as product_id, p.price_jod, p.compare_at_price_jod
  from products p
  where not exists (select 1 from product_variants v where v.product_id=p.id)
)
insert into product_variants (product_id, label, price_jod, compare_at_price_jod, is_default, is_active, sort_order)
select product_id, 'Standard', price_jod, compare_at_price_jod, true, true, 0
from missing;
