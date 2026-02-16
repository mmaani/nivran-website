import "server-only";
import { db } from "@/lib/db";

export async function ensureOrdersTables() {
  // 1) Create tables (only if missing)
  await db.query(`
    create table if not exists orders (
      id bigserial primary key,
      cart_id text not null unique,
      status text not null,
      amount numeric(10,2) not null,
      currency text not null default 'JOD'
    );
  `);

  await db.query(`
    create table if not exists paytabs_callbacks (
      id bigserial primary key,
      cart_id text,
      tran_ref text,
      signature_header text,
      signature_computed text,
      signature_valid boolean not null default false,
      raw_body text
    );
  `);

  // 2) Backfill/migrate columns for older DBs
  await db.query(`alter table orders add column if not exists locale text not null default 'en'`);
  await db.query(`alter table orders add column if not exists customer jsonb`);
  await db.query(`alter table orders add column if not exists shipping jsonb`);
  await db.query(`alter table orders add column if not exists items jsonb`);
  await db.query(`alter table orders add column if not exists customer_name text`);
  await db.query(`alter table orders add column if not exists customer_phone text`);
  await db.query(`alter table orders add column if not exists customer_email text`);
  await db.query(`alter table orders add column if not exists shipping_city text`);
  await db.query(`alter table orders add column if not exists shipping_address text`);
  await db.query(`alter table orders add column if not exists shipping_country text`);
  await db.query(`alter table orders add column if not exists notes text`);
  await db.query(`alter table orders add column if not exists subtotal_before_discount_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists discount_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists subtotal_after_discount_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists shipping_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists total_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists promo_code text`);
  await db.query(`alter table orders add column if not exists promotion_id bigint`);
  await db.query(`alter table orders add column if not exists payment_method text not null default 'PAYTABS'`);
  await db.query(`alter table orders add column if not exists customer_id bigint`);
  await db.query(`alter table orders add column if not exists paytabs_tran_ref text`);
  await db.query(`alter table orders add column if not exists paytabs_last_payload text`);
  await db.query(`alter table orders add column if not exists paytabs_last_signature text`);
  await db.query(`alter table orders add column if not exists paytabs_response_status text`);
  await db.query(`alter table orders add column if not exists paytabs_response_message text`);

  // Keep amount/currency in sync for legacy readers.
  await db.query(`
    update orders
       set amount = coalesce(total_jod, amount)
     where total_jod is not null
       and (amount is null or amount <> total_jod)
  `);

  await db.query(`
    update orders
       set currency = coalesce(nullif(currency,''), 'JOD')
     where currency is null or currency = ''
  `);

  // timestamps
  await db.query(`alter table orders add column if not exists created_at timestamptz not null default now()`);
  await db.query(`alter table orders add column if not exists updated_at timestamptz not null default now()`);

  await db.query(`alter table paytabs_callbacks add column if not exists payload jsonb`);
  await db.query(`alter table paytabs_callbacks add column if not exists created_at timestamptz not null default now()`);

  await db.query(`alter table paytabs_callbacks add column if not exists received_at timestamptz not null default now()`);

  // 3) Indexes last (so columns definitely exist)
  await db.query(`create index if not exists idx_orders_cart_id on orders(cart_id)`);
  await db.query(`create index if not exists idx_orders_status on orders(status)`);
  await db.query(`create index if not exists idx_orders_created_at on orders(created_at desc)`);
  await db.query(`create index if not exists idx_orders_paytabs_tran_ref on orders(paytabs_tran_ref)`);
  await db.query(`create index if not exists idx_orders_promo_code on orders(promo_code)`);

  await db.query(`create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id)`);
  await db.query(`create index if not exists idx_paytabs_callbacks_tran_ref on paytabs_callbacks(tran_ref)`);
  await db.query(`create index if not exists idx_paytabs_callbacks_created_at on paytabs_callbacks(created_at desc)`);
  await db.query(`create index if not exists idx_paytabs_callbacks_received_at on paytabs_callbacks(received_at desc)`);
}
