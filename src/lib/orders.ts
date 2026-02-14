import { db } from "@/lib/db";

export async function ensureOrdersTables() {
  await db.query(`
    create table if not exists orders (
      id bigserial primary key,
      cart_id text not null unique,
      status text not null,
      amount numeric(10,2) not null,
      currency text not null default 'JOD',
      locale text not null default 'en',
      customer jsonb,
      shipping jsonb,
      customer_name text,
      customer_email text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists paytabs_callbacks (
      id bigserial primary key,
      cart_id text,
      tran_ref text,
      signature_header text,
      signature_computed text,
      signature_valid boolean not null default false,
      raw_body text,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_orders_cart_id on orders(cart_id);
    create index if not exists idx_orders_status on orders(status);
    create index if not exists idx_orders_created_at on orders(created_at desc);
    create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id);
    create index if not exists idx_paytabs_callbacks_created_at on paytabs_callbacks(created_at desc);
  `);

  await db.query(`alter table orders add column if not exists locale text not null default 'en'`);
  await db.query(`alter table orders add column if not exists customer jsonb`);
  await db.query(`alter table orders add column if not exists shipping jsonb`);
  await db.query(`alter table orders add column if not exists customer_name text`);
  await db.query(`alter table orders add column if not exists customer_email text`);
  await db.query(`alter table orders add column if not exists payment_method text not null default 'PAYTABS'`);
  await db.query(`alter table orders add column if not exists customer_id bigint`);
  await db.query(`alter table orders add column if not exists paytabs_tran_ref text`);
  await db.query(`alter table orders add column if not exists paytabs_last_payload text`);
  await db.query(`alter table orders add column if not exists paytabs_last_signature text`);
  await db.query(`alter table orders add column if not exists paytabs_response_status text`);
  await db.query(`alter table orders add column if not exists paytabs_response_message text`);
}
