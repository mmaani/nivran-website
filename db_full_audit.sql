BEGIN;

/* ============================================================
   NIVRAN — FULL WEBSITE DATABASE AUDIT (READ-ONLY)
   Scope: ALL tables in public schema
   Notes:
   - Reads only
   - Uses TEMP tables that drop automatically at session end
   ============================================================ */

select current_database() as db, current_schema() as schema, now() as now_utc;

-- 0) DB + extensions + version
select version() as postgres_version;

select extname, extversion
from pg_extension
order by extname;

-- 1) Table inventory
select table_schema, table_name
from information_schema.tables
where table_schema='public' and table_type='BASE TABLE'
order by table_name;

-- 2) Row counts for ALL tables (exact)
drop table if exists audit_table_counts;
create temp table audit_table_counts (
  table_name text not null,
  rows_estimated bigint not null,
  rows_exact bigint
) on commit drop;

insert into audit_table_counts(table_name, rows_estimated)
select c.relname as table_name,
       c.reltuples::bigint as rows_estimated
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

do $$
declare
  r record;
  q text;
begin
  for r in select table_name from audit_table_counts loop
    q := 'update audit_table_counts set rows_exact=(select count(*)::bigint from public.' || quote_ident(r.table_name) || ') where table_name=' || quote_literal(r.table_name) || ';';
    execute q;
  end loop;
end $$;

select *
from audit_table_counts
order by rows_exact desc nulls last, table_name;

-- 3) Column profile for ALL tables
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema='public'
order by c.table_name, c.ordinal_position;

-- 4) Primary keys / uniques / foreign keys (summary)
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema='public'
order by tc.table_name, tc.constraint_type, tc.constraint_name;

select
  kcu.table_name,
  kcu.constraint_name,
  kcu.column_name,
  kcu.ordinal_position
from information_schema.key_column_usage kcu
where kcu.table_schema='public'
order by kcu.table_name, kcu.constraint_name, kcu.ordinal_position;

-- FK mapping details
select
  tc.table_name as fk_table,
  tc.constraint_name as fk_name,
  kcu.column_name as fk_column,
  ccu.table_name as ref_table,
  ccu.column_name as ref_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'
order by fk_table, fk_name, kcu.ordinal_position;

-- 5) Index audit
select
  t.relname as table_name,
  i.relname as index_name,
  ix.indisunique as is_unique,
  ix.indisprimary as is_primary,
  pg_get_indexdef(ix.indexrelid) as index_def
from pg_index ix
join pg_class t on t.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname='public'
order by t.relname, i.relname;

-- 6) Foreign key violations (dynamic for ALL FKs)
drop table if exists audit_fk_violations;
create temp table audit_fk_violations (
  fk_table text not null,
  fk_name text not null,
  ref_table text not null,
  violation_count bigint not null,
  sample_sql text not null
) on commit drop;

do $$
declare
  r record;
  join_cond text;
  fk_cols text;
  ref_cols text;
  null_guard text;
  q text;
  vcount bigint;
begin
  for r in
    select
      con.conname as fk_name,
      c1.relname as fk_table,
      c2.relname as ref_table,
      con.conkey as fk_attnums,
      con.confkey as ref_attnums
    from pg_constraint con
    join pg_class c1 on c1.oid = con.conrelid
    join pg_namespace n1 on n1.oid = c1.relnamespace
    join pg_class c2 on c2.oid = con.confrelid
    join pg_namespace n2 on n2.oid = c2.relnamespace
    where con.contype='f' and n1.nspname='public'
    order by c1.relname, con.conname
  loop
    select
      string_agg('f.'||quote_ident(a1.attname)||' = r.'||quote_ident(a2.attname), ' and '),
      string_agg('f.'||quote_ident(a1.attname), ', '),
      string_agg('r.'||quote_ident(a2.attname), ', '),
      string_agg('f.'||quote_ident(a1.attname)||' is not null', ' and ')
    into join_cond, fk_cols, ref_cols, null_guard
    from unnest(r.fk_attnums) with ordinality fk(attnum, ord)
    join pg_attribute a1
      on a1.attrelid = (select oid from pg_class where relname=r.fk_table and relnamespace=(select oid from pg_namespace where nspname='public'))
     and a1.attnum = fk.attnum
    join unnest(r.ref_attnums) with ordinality rf(attnum, ord)
      on rf.ord = fk.ord
    join pg_attribute a2
      on a2.attrelid = (select oid from pg_class where relname=r.ref_table and relnamespace=(select oid from pg_namespace where nspname='public'))
     and a2.attnum = rf.attnum;

    q :=
      'select count(*)::bigint '||
      'from public.'||quote_ident(r.fk_table)||' f '||
      'left join public.'||quote_ident(r.ref_table)||' r on '||join_cond||' '||
      'where ('||null_guard||') and '||split_part(ref_cols, ', ', 1)||' is null;';

    execute q into vcount;

    insert into audit_fk_violations(fk_table, fk_name, ref_table, violation_count, sample_sql)
    values (
      r.fk_table,
      r.fk_name,
      r.ref_table,
      vcount,
      'select * from public.'||quote_ident(r.fk_table)||' f left join public.'||quote_ident(r.ref_table)||' r on '||join_cond||' where ('||null_guard||') and '||split_part(ref_cols, ', ', 1)||' is null limit 50;'
    );
  end loop;
end $$;

select *
from audit_fk_violations
where violation_count > 0
order by violation_count desc, fk_table, fk_name;

-- 7) Unique index duplicate-risk audit (best-effort)
drop table if exists audit_unique_duplicates;
create temp table audit_unique_duplicates (
  table_name text not null,
  index_name text not null,
  duplicate_groups bigint not null,
  sample_sql text not null
) on commit drop;

do $$
declare
  r record;
  cols text;
  q text;
  dgroups bigint;
begin
  for r in
    select
      t.relname as table_name,
      i.relname as index_name,
      ix.indexrelid as index_oid
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_class i on i.oid = ix.indexrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public'
      and ix.indisunique=true
      and ix.indisprimary=false
    order by t.relname, i.relname
  loop
    select string_agg(quote_ident(a.attname), ', ')
    into cols
    from pg_attribute a
    join unnest((select indkey from pg_index where indexrelid=r.index_oid)) with ordinality k(attnum, ord)
      on k.attnum=a.attnum
    where a.attrelid = (select oid from pg_class where relname=r.table_name and relnamespace=(select oid from pg_namespace where nspname='public'))
      and a.attnum > 0;

    if cols is null or length(cols)=0 then
      continue;
    end if;

    q :=
      'select count(*)::bigint from ('||
      'select '||cols||', count(*) as c from public.'||quote_ident(r.table_name)||' group by '||cols||' having count(*) > 1'||
      ') x;';

    execute q into dgroups;

    insert into audit_unique_duplicates(table_name, index_name, duplicate_groups, sample_sql)
    values (
      r.table_name,
      r.index_name,
      dgroups,
      'select '||cols||', count(*) as c from public.'||quote_ident(r.table_name)||' group by '||cols||' having count(*) > 1 order by c desc limit 50;'
    );
  end loop;
end $$;

select *
from audit_unique_duplicates
where duplicate_groups > 0
order by duplicate_groups desc, table_name, index_name;

-- 8) Null-risk heuristic (nullable columns that look like identifiers)
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema='public'
  and c.is_nullable='YES'
  and (
    c.column_name = 'id'
    or c.column_name like '%\_id' escape '\'
    or c.column_name in ('slug','key','email','code','sku')
  )
order by c.table_name, c.column_name;

-- 9) Full constraint definitions
select
  n.nspname as schema,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
order by table_name, constraint_type, constraint_name;

select 'AUDIT_DONE' as status, now() as finished_at_utc;

COMMIT;
