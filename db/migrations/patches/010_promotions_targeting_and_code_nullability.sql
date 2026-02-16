-- 010_promotions_targeting_and_code_nullability.sql
-- Purpose:
-- 1) Allow AUTO promotions without a code (code nullable)
-- 2) Add targeting + ranking columns used by storefront promo badges
-- 3) Keep CODE promotions unique while AUTO promotions remain code-less

alter table if exists promotions
  add column if not exists priority integer not null default 0;

alter table if exists promotions
  add column if not exists product_slugs text[];

alter table if exists promotions
  alter column code drop not null;

update promotions
set promo_kind = case
  when nullif(btrim(code), '') is null then 'AUTO'
  else 'CODE'
end
where promo_kind is null or promo_kind not in ('AUTO', 'CODE');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'promotions_kind_code_chk'
  ) then
    alter table promotions
      add constraint promotions_kind_code_chk
      check (
        (promo_kind = 'AUTO' and (code is null or btrim(code) = ''))
        or
        (promo_kind = 'CODE' and code is not null and btrim(code) <> '')
      );
  end if;
end $$;

drop index if exists idx_promotions_code_unique;
create unique index if not exists idx_promotions_code_unique
  on promotions(code)
  where promo_kind='CODE' and code is not null and btrim(code) <> '';

create index if not exists idx_promotions_priority on promotions(priority desc);
create index if not exists idx_promotions_category_keys_gin on promotions using gin(category_keys);
create index if not exists idx_promotions_product_slugs_gin on promotions using gin(product_slugs);
