-- Ensure staff_users role constraint accepts sales role before role normalization updates.

do $$
declare
  has_table boolean;
  has_role_check boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema='public' and table_name='staff_users'
  ) into has_table;

  if not has_table then
    return;
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public'
      and t.relname='staff_users'
      and c.conname='staff_users_role_check'
  ) into has_role_check;

  if has_role_check then
    alter table public.staff_users drop constraint staff_users_role_check;
  end if;

  alter table public.staff_users
    add constraint staff_users_role_check
    check (role in ('admin','ops','sales','staff'));
end $$;

-- Normalize legacy role values after constraint safely accepts both values.
update staff_users
   set role='sales',
       updated_at=now()
 where lower(coalesce(role,''))='staff';
