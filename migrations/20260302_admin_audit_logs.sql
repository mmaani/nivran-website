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
