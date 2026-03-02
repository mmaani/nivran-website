// src/lib/refundsSchema.ts
import "server-only";
import { db } from "@/lib/db";

export async function ensureRefundTablesSafe(): Promise<void> {
  await db.query(`
    create table if not exists refunds (
      id bigserial primary key,
      order_id bigint not null,
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

  await db.query(`create unique index if not exists refunds_idempotency_key_idx on refunds (idempotency_key)`);
  await db.query(`create index if not exists refunds_order_id_idx on refunds(order_id)`);
  await db.query(`create index if not exists refunds_status_idx on refunds(status)`);

  await db.query(`
    alter table refunds
    drop constraint if exists refunds_order_fk
  `);
  await db.query(`
    alter table refunds
    add constraint refunds_order_fk
    foreign key (order_id) references orders(id)
  `);

  await db.query(`
    alter table refunds
    add constraint refunds_status_check
    check (status in ('REQUESTED','CONFIRMED','RESTOCK_SCHEDULED','RESTOCKED','FAILED'))
  `).catch(() => undefined);

  await db.query(`
    create table if not exists restock_jobs (
      id bigserial primary key,
      refund_id bigint not null,
      status text not null,
      run_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      attempts int not null default 0,
      last_error text null
    );
  `);

  await db.query(`alter table restock_jobs add column if not exists refund_id bigint`);
  await db.query(`alter table restock_jobs add column if not exists status text`);
  await db.query(`alter table restock_jobs add column if not exists run_at timestamptz`);
  await db.query(`alter table restock_jobs add column if not exists created_at timestamptz not null default now()`);
  await db.query(`alter table restock_jobs add column if not exists updated_at timestamptz not null default now()`);
  await db.query(`alter table restock_jobs add column if not exists attempts int not null default 0`);
  await db.query(`alter table restock_jobs add column if not exists last_error text`);

  await db.query(`create unique index if not exists restock_jobs_refund_id_ux on restock_jobs(refund_id)`);
  await db.query(`create index if not exists restock_jobs_run_at_idx on restock_jobs(status, run_at)`);

  await db.query(`alter table restock_jobs drop constraint if exists restock_jobs_refund_fk`);
  await db.query(`alter table restock_jobs add constraint restock_jobs_refund_fk foreign key (refund_id) references refunds(id)`);

  await db.query(`
    create table if not exists admin_audit_logs (
      id bigserial primary key,
      admin_id text not null,
      action text not null,
      entity text not null,
      entity_id text,
      metadata jsonb,
      ip_address text,
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`create index if not exists orders_created_at_idx on orders (created_at desc)`);
  await db.query(`create index if not exists orders_status_idx on orders (status)`);
  await db.query(`create index if not exists orders_payment_method_idx on orders (payment_method)`);
  await db.query(`create index if not exists orders_inventory_commit_idx on orders (inventory_committed_at)`);
  await db.query(`create index if not exists orders_customer_gin_idx on orders using gin (customer)`);
}
