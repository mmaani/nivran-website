// src/lib/refundsSchema.ts
import "server-only";
import { db } from "@/lib/db";

export async function ensureRefundTablesSafe(): Promise<void> {
  // Refunds table: records every refund attempt (PayTabs + manual)
  await db.query(`
    create table if not exists refunds (
      id bigserial primary key,
      order_id bigint not null,
      cart_id text,
      payment_method text,
      refund_method text not null default 'PAYTABS', -- PAYTABS | MANUAL
      amount_jod numeric(10,2) not null default 0,
      reason text,

      -- idempotency to prevent double-refunds from double-clicks
      idempotency_key text not null,

      status text not null default 'PREPARED', -- PREPARED | REQUESTED | SUCCEEDED | FAILED | MANUAL_REQUIRED
      error_message text,
      provider_status text,
      provider_message text,

      paytabs_tran_ref text,
      provider_payload jsonb,

      -- restock workflow
      restock_policy text not null default 'DELAYED', -- IMMEDIATE | DELAYED
      restock_at timestamptz,
      restocked_at timestamptz,

      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Unique idempotency per order
  await db.query(`
    create unique index if not exists refunds_order_id_idem_ux
    on refunds(order_id, idempotency_key);
  `);

  await db.query(`
    create index if not exists refunds_order_id_idx
    on refunds(order_id);
  `);

  await db.query(`
    create index if not exists refunds_restock_at_idx
    on refunds(restock_at)
    where restocked_at is null;
  `);

  // Minimal columns on orders (safe add)
  await db.query(`alter table orders add column if not exists refunded_amount_jod numeric(10,2) not null default 0;`);
  await db.query(`alter table orders add column if not exists refund_status text;`);
  await db.query(`alter table orders add column if not exists refund_updated_at timestamptz;`);
}