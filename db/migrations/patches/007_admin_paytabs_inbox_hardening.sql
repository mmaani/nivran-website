-- Admin + PayTabs + inbox hardening (idempotent)

alter table if exists orders
  add column if not exists paytabs_tran_ref text;

create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_cart_id on orders(cart_id);
create index if not exists idx_orders_paytabs_tran_ref on orders(paytabs_tran_ref);

alter table if exists paytabs_callbacks
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists payload jsonb;

create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id);
create index if not exists idx_paytabs_callbacks_tran_ref on paytabs_callbacks(tran_ref);
create index if not exists idx_paytabs_callbacks_created_at on paytabs_callbacks(created_at desc);
create index if not exists idx_paytabs_callbacks_received_at on paytabs_callbacks(received_at desc);

alter table if exists contact_submissions
  add column if not exists topic text,
  add column if not exists subject text,
  add column if not exists order_ref text;

create index if not exists idx_contact_created_at on contact_submissions(created_at desc);
create index if not exists idx_contact_email on contact_submissions(email);
create index if not exists idx_contact_topic on contact_submissions(topic);

create index if not exists idx_newsletter_created_at on newsletter_subscribers(created_at desc);
