-- Admin Recovery Baseline (safe to run multiple times)
-- Purpose: quickly restore required admin/sales tables, columns, constraints, and indexes
-- for environments where previous migrations did not fully apply.

begin;

-- Orders + callbacks
create table if not exists orders (
  id bigserial primary key,
  cart_id text not null unique,
  status text not null,
  amount numeric(10,2) not null default 0,
  currency text not null default 'JOD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders add column if not exists locale text not null default 'en';
alter table orders add column if not exists customer jsonb;
alter table orders add column if not exists shipping jsonb;
alter table orders add column if not exists items jsonb;
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists customer_email text;
alter table orders add column if not exists shipping_city text;
alter table orders add column if not exists shipping_address text;
alter table orders add column if not exists shipping_country text;
alter table orders add column if not exists notes text;
alter table orders add column if not exists subtotal_before_discount_jod numeric(10,2);
alter table orders add column if not exists discount_jod numeric(10,2);
alter table orders add column if not exists subtotal_after_discount_jod numeric(10,2);
alter table orders add column if not exists shipping_jod numeric(10,2);
alter table orders add column if not exists total_jod numeric(10,2);
alter table orders add column if not exists promo_code text;
alter table orders add column if not exists promotion_id bigint;
alter table orders add column if not exists discount_source text;
alter table orders add column if not exists promo_consumed boolean not null default false;
alter table orders add column if not exists promo_consumed_at timestamptz;
alter table orders add column if not exists promo_consume_failed boolean not null default false;
alter table orders add column if not exists promo_consume_error text;
alter table orders add column if not exists payment_method text not null default 'PAYTABS';
alter table orders add column if not exists customer_id bigint;
alter table orders add column if not exists paytabs_tran_ref text;
alter table orders add column if not exists paytabs_last_payload text;
alter table orders add column if not exists paytabs_last_signature text;
alter table orders add column if not exists paytabs_response_status text;
alter table orders add column if not exists paytabs_response_message text;
alter table orders add column if not exists inventory_committed_at timestamptz;

create table if not exists paytabs_callbacks (
  id bigserial primary key,
  cart_id text,
  tran_ref text,
  signature_header text,
  signature_computed text,
  signature_valid boolean not null default false,
  raw_body text,
  payload jsonb,
  created_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

-- Inbox + newsletter
create table if not exists contact_submissions (
  id bigserial primary key,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  locale text not null default 'en',
  topic text,
  subject text,
  order_ref text,
  created_at timestamptz not null default now()
);

create table if not exists newsletter_subscribers (
  id bigserial primary key,
  email text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Identity + staff
create table if not exists customers (
  id bigserial primary key,
  email text unique not null,
  password_hash text not null,
  full_name text,
  phone text,
  address_line1 text,
  city text,
  country text,
  is_active boolean not null default true,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff_users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  full_name text,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update staff_users set role='sales' where lower(role)='staff';

alter table staff_users drop constraint if exists staff_users_role_check;
alter table staff_users add constraint staff_users_role_check check (role in ('admin','ops','sales','staff'));

-- Sales portal tables
create table if not exists staff_login_attempts (
  id bigserial primary key,
  username text not null,
  ip text,
  user_agent text,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sales_audit_logs (
  id bigserial primary key,
  order_id bigint,
  actor_role text,
  actor_staff_id bigint,
  actor_username text,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Email logs (for dedupe + observability)
create table if not exists email_send_logs (
  id bigserial primary key,
  provider text not null default 'resend',
  kind text not null,
  "to" text not null,
  subject text,
  ok boolean not null default false,
  attempt int not null default 0,
  provider_id text,
  error text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Core indexes used by admin tabs
create index if not exists idx_orders_cart_id on orders(cart_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_inventory_committed_at on orders(inventory_committed_at);
create index if not exists idx_contact_created_at on contact_submissions(created_at desc);
create unique index if not exists ux_newsletter_email on newsletter_subscribers(email);
create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at desc);
create index if not exists idx_staff_users_role on staff_users(role);
create index if not exists idx_staff_users_active on staff_users(is_active);
create index if not exists idx_staff_login_attempts_username_created_at on staff_login_attempts(username, created_at desc);
create index if not exists idx_sales_audit_logs_order_id on sales_audit_logs(order_id);
create index if not exists idx_sales_audit_logs_actor_staff_id_created_at on sales_audit_logs(actor_staff_id, created_at desc);
create index if not exists email_send_logs_to_idx on email_send_logs("to");
create index if not exists email_send_logs_created_at_idx on email_send_logs(created_at desc);
create index if not exists email_send_logs_kind_idx on email_send_logs(kind);

commit;
