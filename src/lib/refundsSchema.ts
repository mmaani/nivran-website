// src/lib/refundsSchema.ts
import "server-only";
import { db } from "@/lib/db";

export async function ensureRefundTablesSafe(): Promise<void> {
  // 1) refunds table (canonical based on db/migrations/patches/020_refunds.sql)
  await db.query(`
    create table if not exists refunds (
      id bigserial primary key,
      order_id bigint not null references orders(id) on delete cascade,
      method text not null check (method in ('PAYTABS', 'MANUAL')),
      amount_jod numeric(10,2) not null check (amount_jod > 0),
      currency text not null default 'JOD',
      reason text null,
      idempotency_key text not null,
      status text not null,
      paytabs_tran_ref text null,
      paytabs_refund_reference text null,
      restocked boolean not null default false,
      requested_at timestamptz not null default now(),
      succeeded_at timestamptz null,
      failed_at timestamptz null,
      last_error text null,
      payload jsonb null
    );
  `);

  // Add missing columns if refunds existed with an older drifted shape
  await db.query(`alter table refunds add column if not exists order_id bigint`);
  await db.query(`alter table refunds add column if not exists method text`);
  await db.query(`alter table refunds add column if not exists amount_jod numeric(10,2)`);
  await db.query(`alter table refunds add column if not exists currency text`);
  await db.query(`alter table refunds add column if not exists reason text`);
  await db.query(`alter table refunds add column if not exists idempotency_key text`);
  await db.query(`alter table refunds add column if not exists status text`);
  await db.query(`alter table refunds add column if not exists paytabs_tran_ref text`);
  await db.query(`alter table refunds add column if not exists paytabs_refund_reference text`);
  await db.query(`alter table refunds add column if not exists restocked boolean not null default false`);
  await db.query(`alter table refunds add column if not exists requested_at timestamptz not null default now()`);
  await db.query(`alter table refunds add column if not exists succeeded_at timestamptz`);
  await db.query(`alter table refunds add column if not exists failed_at timestamptz`);
  await db.query(`alter table refunds add column if not exists last_error text`);
  await db.query(`alter table refunds add column if not exists payload jsonb`);

  // Enforce idempotency unique index
  await db.query(`
    create unique index if not exists refunds_order_id_idem_key_ux
      on refunds(order_id, idempotency_key);
  `);

  await db.query(`create index if not exists refunds_order_id_idx on refunds(order_id);`);
  await db.query(`create index if not exists refunds_status_idx on refunds(status);`);

  // 2) restock_jobs table (new, required by architecture)
  await db.query(`
    create table if not exists restock_jobs (
      id bigserial primary key,
      order_id bigint not null references orders(id) on delete cascade,
      refund_id bigint not null references refunds(id) on delete cascade,

      status text not null check (status in ('SCHEDULED','DONE','CANCELED','FAILED')),
      run_at timestamptz not null,

      attempts int not null default 0,
      last_error text null,

      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      done_at timestamptz null
    );
  `);

  // One restock job per refund (idempotent scheduling)
  await db.query(`
    create unique index if not exists restock_jobs_refund_id_ux
      on restock_jobs(refund_id);
  `);

  await db.query(`
    create index if not exists restock_jobs_run_at_idx
      on restock_jobs(status, run_at);
  `);
}