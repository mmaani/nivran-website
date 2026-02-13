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

-- CONTACT SUBMISSIONS
create table if not exists contact_submissions (
  id bigserial primary key,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_submissions_created_at on contact_submissions(created_at desc);

-- NEWSLETTER SUBSCRIBERS
create table if not exists newsletter_subscribers (
  id bigserial primary key,
  email text not null unique,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_newsletter_subscribers_created_at on newsletter_subscribers(created_at desc);

-- CATALOG / CRM
create table if not exists products (
  id bigserial primary key,
  slug text not null unique,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  price_jod numeric(10,2) not null,
  compare_at_price_jod numeric(10,2),
  inventory_qty integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_active on products(is_active);

create table if not exists promotions (
  id bigserial primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  discount_type text not null check (discount_type in ('PERCENT','FIXED')),
  discount_value numeric(10,2) not null,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_promotions_active on promotions(is_active);

-- CUSTOMER IDENTITY + STAFF
create table if not exists customers (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  first_name text,
  last_name text,
  phone text,
  locale text not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_sessions (
  id bigserial primary key,
  customer_id bigint not null references customers(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists idx_customer_sessions_customer_id on customer_sessions(customer_id);
create index if not exists idx_customer_sessions_token on customer_sessions(token);

create table if not exists staff_users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
