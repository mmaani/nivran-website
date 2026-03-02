create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_payment_method_idx on orders (payment_method);
create index if not exists orders_inventory_commit_idx on orders (inventory_committed_at);
create index if not exists orders_customer_gin_idx on orders using gin (customer);

create unique index if not exists refunds_idempotency_key_idx on refunds (idempotency_key);
create index if not exists refunds_status_idx on refunds (status);

create index if not exists restock_jobs_run_at_idx on restock_jobs (status, run_at);
