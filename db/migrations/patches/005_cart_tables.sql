-- Customer cart persisted in DB (account-level)

create table if not exists public.customer_carts (
  customer_id bigint primary key references public.customers(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_cart_items (
  customer_id bigint not null references public.customer_carts(customer_id) on delete cascade,
  slug text not null,
  name text not null,
  price_jod numeric(10,2) not null default 0,
  qty integer not null check (qty > 0),
  updated_at timestamptz not null default now(),
  primary key (customer_id, slug)
);

create index if not exists idx_customer_cart_items_customer on public.customer_cart_items(customer_id);
