-- Safe, rerunnable Neon recovery for admin portal indexes.
-- This script avoids transaction-wide failure by creating indexes only when target tables/columns exist.

-- If Neon says: "Failed transaction: ROLLBACK required"
-- run this first in your SQL editor session:
--   ROLLBACK;

DO $$
BEGIN
  -- orders
  IF to_regclass('public.orders') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='cart_id') THEN
      EXECUTE 'create index if not exists idx_orders_cart_id on public.orders(cart_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='status') THEN
      EXECUTE 'create index if not exists idx_orders_status on public.orders(status)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='created_at') THEN
      EXECUTE 'create index if not exists idx_orders_created_at on public.orders(created_at desc)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='inventory_committed_at') THEN
      EXECUTE 'create index if not exists idx_orders_inventory_committed_at on public.orders(inventory_committed_at)';
    END IF;
  END IF;

  -- contact/newsletter
  IF to_regclass('public.contact_submissions') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contact_submissions' AND column_name='created_at') THEN
    EXECUTE 'create index if not exists idx_contact_created_at on public.contact_submissions(created_at desc)';
  END IF;

  IF to_regclass('public.newsletter_subscribers') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_subscribers' AND column_name='email') THEN
      EXECUTE 'create unique index if not exists ux_newsletter_email on public.newsletter_subscribers(email)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_subscribers' AND column_name='created_at') THEN
      EXECUTE 'create index if not exists idx_newsletter_created_at on public.newsletter_subscribers(created_at desc)';
    END IF;
  END IF;

  -- staff + sales logs
  IF to_regclass('public.staff_users') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_users' AND column_name='role') THEN
      EXECUTE 'create index if not exists idx_staff_users_role on public.staff_users(role)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_users' AND column_name='is_active') THEN
      EXECUTE 'create index if not exists idx_staff_users_active on public.staff_users(is_active)';
    END IF;
  END IF;

  IF to_regclass('public.staff_login_attempts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_login_attempts' AND column_name='username')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_login_attempts' AND column_name='created_at') THEN
    EXECUTE 'create index if not exists idx_staff_login_attempts_username_created_at on public.staff_login_attempts(username, created_at desc)';
  END IF;

  IF to_regclass('public.sales_audit_logs') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_audit_logs' AND column_name='order_id') THEN
      EXECUTE 'create index if not exists idx_sales_audit_logs_order_id on public.sales_audit_logs(order_id)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_audit_logs' AND column_name='actor_staff_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_audit_logs' AND column_name='created_at') THEN
      EXECUTE 'create index if not exists idx_sales_audit_logs_actor_staff_id_created_at on public.sales_audit_logs(actor_staff_id, created_at desc)';
    END IF;
  END IF;

  -- email logs
  IF to_regclass('public.email_send_logs') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_send_logs' AND column_name='to') THEN
      EXECUTE 'create index if not exists email_send_logs_to_idx on public.email_send_logs("to")';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_send_logs' AND column_name='created_at') THEN
      EXECUTE 'create index if not exists email_send_logs_created_at_idx on public.email_send_logs(created_at desc)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_send_logs' AND column_name='kind') THEN
      EXECUTE 'create index if not exists email_send_logs_kind_idx on public.email_send_logs(kind)';
    END IF;
  END IF;
END
$$;

-- Optional verification query
-- select schemaname, tablename, indexname
-- from pg_indexes
-- where schemaname='public'
--   and indexname in (
--     'idx_orders_cart_id','idx_orders_status','idx_orders_created_at','idx_orders_inventory_committed_at',
--     'idx_contact_created_at','ux_newsletter_email','idx_newsletter_created_at',
--     'idx_staff_users_role','idx_staff_users_active',
--     'idx_staff_login_attempts_username_created_at',
--     'idx_sales_audit_logs_order_id','idx_sales_audit_logs_actor_staff_id_created_at',
--     'email_send_logs_to_idx','email_send_logs_created_at_idx','email_send_logs_kind_idx'
--   )
-- order by indexname;
