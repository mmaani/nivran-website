-- 009_discount_mode_constraints.sql
-- Promotions type split (AUTO vs CODE) + orders discount source guardrails.

alter table if exists promotions add column if not exists promo_kind text not null default 'CODE';

update promotions
   set promo_kind = case when nullif(code,'') is null then 'AUTO' else 'CODE' end
 where promo_kind is null or promo_kind not in ('AUTO','CODE');

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

drop index if exists idx_promotions_code_unique;
create unique index if not exists idx_promotions_code_unique on promotions(code) where promo_kind='CODE';
create index if not exists idx_promotions_kind on promotions(promo_kind);

alter table if exists orders add column if not exists discount_source text;


do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='orders_discount_source_chk'
  ) then
    alter table orders
      add constraint orders_discount_source_chk
      check (discount_source in ('AUTO','CODE') or discount_source is null);
  end if;
end $$;


do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='orders_single_discount_chk'
  ) then
    alter table orders
      add constraint orders_single_discount_chk
      check (
        (discount_source is null and promo_code is null)
        or (discount_source='AUTO' and promo_code is null)
        or (discount_source='CODE' and promo_code is not null)
      );
  end if;
end $$;
