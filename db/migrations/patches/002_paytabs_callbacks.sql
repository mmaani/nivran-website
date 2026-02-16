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

create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id);
create index if not exists idx_paytabs_callbacks_tran_ref on paytabs_callbacks(tran_ref);
