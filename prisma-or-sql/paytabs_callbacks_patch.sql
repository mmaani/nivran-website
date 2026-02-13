-- Ensure the table exists (safe if already exists)
create table if not exists paytabs_callbacks (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  cart_id text,
  tran_ref text
);

-- Add missing columns safely (this fixes your missing signature_valid)
alter table if exists paytabs_callbacks
  add column if not exists signature_header text,
  add column if not exists signature_computed text not null default '',
  add column if not exists signature_valid boolean not null default false,
  add column if not exists raw_body text not null default '';

create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id);
create index if not exists idx_paytabs_callbacks_tran_ref on paytabs_callbacks(tran_ref);
