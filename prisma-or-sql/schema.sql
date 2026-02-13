-- ORDERS
create table if not exists orders (
  id bigserial primary key,
  cart_id text not null unique,
  status text not null default 'PENDING_PAYMENT',
  amount numeric(10,2) not null,
  currency text not null default 'JOD',
  locale text not null default 'en',

  payment_method text not null default 'PAYTABS', -- PAYTABS | COD
  customer jsonb,
  shipping jsonb,

  customer_email text,
  customer_name text,

  paytabs_tran_ref text,
  paytabs_last_payload text,
  paytabs_last_signature text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders add column if not exists payment_method text not null default 'PAYTABS';
alter table orders add column if not exists customer jsonb;
alter table orders add column if not exists shipping jsonb;
alter table orders add column if not exists customer_email text;
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists paytabs_tran_ref text;
alter table orders add column if not exists paytabs_last_payload text;
alter table orders add column if not exists paytabs_last_signature text;

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at desc);

-- PAYTABS CALLBACK LOGS
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
create index if not exists idx_paytabs_callbacks_received_at on paytabs_callbacks(received_at desc);
