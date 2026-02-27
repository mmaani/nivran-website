-- Sales portal RBAC + audit support
create table if not exists staff_login_attempts (
  id bigserial primary key,
  username text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);
create index if not exists idx_staff_login_attempts_username_time on staff_login_attempts (username, attempted_at desc);

create table if not exists sales_audit_logs (
  id bigserial primary key,
  order_id bigint,
  actor_role text not null,
  actor_staff_id bigint,
  actor_username text,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_audit_logs_order on sales_audit_logs (order_id);
create index if not exists idx_sales_audit_logs_actor on sales_audit_logs (actor_staff_id, created_at desc);
