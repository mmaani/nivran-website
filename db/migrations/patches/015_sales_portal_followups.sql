-- Sales portal follow-ups for Neon rollout safety + query performance

-- 1) Normalize legacy role values so UI/API role model stays consistent.
update staff_users
   set role = 'sales',
       updated_at = now()
 where lower(coalesce(role, '')) = 'staff';

-- 2) Keep login throttle queries fast under load.
create index if not exists idx_staff_login_attempts_user_success_time
  on staff_login_attempts (username, success, attempted_at desc);

-- 3) Keep sales order feed and staff-scoped order lookups fast.
create index if not exists idx_sales_audit_logs_action_time
  on sales_audit_logs (action, created_at desc);

create index if not exists idx_sales_audit_logs_actor_action_time
  on sales_audit_logs (actor_staff_id, action, created_at desc);

-- 4) Helpful staff directory lookup index for admin panel filtering.
create index if not exists idx_staff_users_role_active
  on staff_users (role, is_active, updated_at desc);
