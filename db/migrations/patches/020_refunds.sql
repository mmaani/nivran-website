-- db/migrations/patches/020_refunds.sql
-- Refunds: hybrid model (PayTabs online + manual POS/cash)
-- Safe goals:
-- - One refund record per idempotency key per order
-- - Optional restock on success (only once)
-- - Audit trail payload storage

create table if not exists refunds (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,

  -- HYBRID method:
  -- PAYTABS  => call PayTabs refund endpoint (requires tran_ref)
  -- MANUAL   => POS/cash refund done offline (no PayTabs call)
  method text not null check (method in ('PAYTABS', 'MANUAL')),

  -- Requested amount (JOD) for this refund action
  amount_jod numeric(10,2) not null check (amount_jod > 0),

  currency text not null default 'JOD',

  reason text null,

  -- Idempotency: prevents duplicates from retries/double-clicks
  idempotency_key text not null,

  -- State machine
  status text not null check (status in ('PENDING', 'SUCCEEDED', 'FAILED')),

  -- PayTabs linkage (nullable for manual)
  paytabs_tran_ref text null,
  paytabs_refund_reference text null,

  -- Only restock once, on success
  restocked boolean not null default false,

  requested_at timestamptz not null default now(),
  succeeded_at timestamptz null,
  failed_at timestamptz null,

  last_error text null,
  payload jsonb null
);

-- Uniqueness: one idempotent refund request per order
create unique index if not exists refunds_order_id_idem_key_ux
  on refunds(order_id, idempotency_key);

-- Helpful query index
create index if not exists refunds_order_id_idx
  on refunds(order_id);

create index if not exists refunds_status_idx
  on refunds(status);