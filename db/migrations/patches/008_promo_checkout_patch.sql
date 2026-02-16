-- 008_promo_checkout_patch.sql
-- Safe idempotent patch for checkout promo-code flow.

alter table if exists promotions add column if not exists min_order_jod numeric(10,2);
alter table if exists promotions add column if not exists used_count integer not null default 0;
create index if not exists idx_promotions_usage on promotions(usage_limit, used_count);

alter table if exists orders add column if not exists promo_code text;
alter table if exists orders add column if not exists promotion_id bigint;
create index if not exists idx_orders_promo_code on orders(promo_code);
