create table if not exists admin_inventory_reconcile_runs (
  key text primary key,
  request_hash text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_inventory_reconcile_runs_created_at_idx
  on admin_inventory_reconcile_runs (created_at desc);
