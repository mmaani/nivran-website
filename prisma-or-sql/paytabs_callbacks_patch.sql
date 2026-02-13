-- Ensure callbacks table exists with required columns (safe if already exists)
create table if not exists paytabs_callbacks (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  cart_id text,
  tran_ref text,
  signature_header text,
  signature_computed text not null,
  signature_valid boolean not null default false,
  raw_body text not null
);

-- If table already existed with fewer columns, add any missing ones
alter table if exists paytabs_callbacks
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists cart_id text,
  add column if not exists tran_ref text,
  add column if not exists signature_header text,
  add column if not exists signature_computed text,
  add column if not exists signature_valid boolean not null default false,
  add column if not exists raw_body text;

-- Backfill NULLs if any (so we can enforce NOT NULL where expected)
update paytabs_callbacks set signature_computed = coalesce(signature_computed, '') where signature_computed is null;
update paytabs_callbacks set raw_body = coalesce(raw_body, '') where raw_body is null;

alter table paytabs_callbacks
  alter column signature_computed set not null,
  alter column raw_body set not null;

create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id);
create index if not exists idx_paytabs_callbacks_tran_ref on paytabs_callbacks(tran_ref);
