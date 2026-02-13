create extension if not exists pgcrypto;

create table if not exists products (
  id bigserial primary key,
  slug text unique not null,
  name text not null,
  price_jod numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  product_id bigint primary key references products(id) on delete cascade,
  qty_on_hand integer not null default 0,
  qty_reserved integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  locale text not null default 'en',
  customer_name text,
  email text,
  phone text,
  total_jod numeric(10,2) not null default 0,
  paytabs_tran_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id bigint not null references products(id),
  qty integer not null,
  unit_price_jod numeric(10,2) not null default 0
);
