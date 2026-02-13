create table if not exists orders (
  id bigserial primary key,
  cart_id text not null unique,
  status text not null default 'PENDING_PAYMENT',
  amount numeric(10,2) not null,
  currency text not null default 'JOD',
  locale text not null default 'en',
  customer_email text,
  customer_name text,
  paytabs_tran_ref text,
  paytabs_response_status text,
  paytabs_response_message text,
  paytabs_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at desc);
