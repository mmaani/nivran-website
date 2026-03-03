#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_DIR="${REPO_ROOT}/audit_outputs"
DATE_STAMP="${1:-$(date -u +%Y%m%d)}"

ARCHIVE_FILE="${AUDIT_DIR}/tables_archive_candidates.txt"
DROP_FILE="${AUDIT_DIR}/tables_drop_later.txt"
PREVIEW_RENAME="${AUDIT_DIR}/preview_archive_rename.sql"
PREVIEW_ROLLBACK="${AUDIT_DIR}/preview_rollback.sql"
PROD_RENAME="${AUDIT_DIR}/prod_archive_rename.sql"
PROD_ROLLBACK="${AUDIT_DIR}/prod_rollback.sql"
PREVIEW_CHECKS="${AUDIT_DIR}/preview_post_rename_checks.sql"

if [[ ! -f "${ARCHIVE_FILE}" || ! -f "${DROP_FILE}" ]]; then
  echo "ERROR: Missing candidate list files in ${AUDIT_DIR}" >&2
  exit 1
fi

mapfile -t TABLES < <(
  cat "${ARCHIVE_FILE}" "${DROP_FILE}" \
    | sed '/^\s*$/d' \
    | sort -u
)

write_rename_file() {
  local out_file="$1"
  {
    echo "BEGIN;"
    for table_name in "${TABLES[@]}"; do
      echo "ALTER TABLE public.${table_name} RENAME TO ${table_name}_archive_${DATE_STAMP};"
    done
    echo "COMMIT;"
  } > "${out_file}"
}

write_rollback_file() {
  local out_file="$1"
  {
    echo "BEGIN;"
    for table_name in "${TABLES[@]}"; do
      echo "ALTER TABLE public.${table_name}_archive_${DATE_STAMP} RENAME TO ${table_name};"
    done
    echo "COMMIT;"
  } > "${out_file}"
}

write_rename_file "${PREVIEW_RENAME}"
write_rollback_file "${PREVIEW_ROLLBACK}"
write_rename_file "${PROD_RENAME}"
write_rollback_file "${PROD_ROLLBACK}"

cat > "${PREVIEW_CHECKS}" <<'SQL'
-- Read-only post-rename checks for core runtime tables.
-- Expected: All queries should succeed and return non-error results.

select 'products' as table_name, count(*)::bigint as rows from public.products;
select 'categories' as table_name, count(*)::bigint as rows from public.categories;
select 'orders' as table_name, count(*)::bigint as rows from public.orders;
select 'customers' as table_name, count(*)::bigint as rows from public.customers;
select 'staff_users' as table_name, count(*)::bigint as rows from public.staff_users;
select 'payments' as table_name, count(*)::bigint as rows from public.payments;
select 'paytabs_callbacks' as table_name, count(*)::bigint as rows from public.paytabs_callbacks;
select 'promotions' as table_name, count(*)::bigint as rows from public.promotions;

-- FK integrity probes (should return 0 violations).
select 'orders_customer_fk_orphans' as check_name, count(*)::bigint as violations
from public.orders o
left join public.customers c on c.id = o.customer_id
where o.customer_id is not null and c.id is null;

select 'payments_order_fk_orphans' as check_name, count(*)::bigint as violations
from public.payments p
left join public.orders o on o.id = p.order_id
where p.order_id is not null and o.id is null;

select 'order_items_order_fk_orphans' as check_name, count(*)::bigint as violations
from public.order_items oi
left join public.orders o on o.id = oi.order_id
where oi.order_id is not null and o.id is null;

select 'order_items_variant_fk_orphans' as check_name, count(*)::bigint as violations
from public.order_items oi
left join public.variants v on v.id = oi.variant_id
where oi.variant_id is not null and v.id is null;

select 'product_images_product_fk_orphans' as check_name, count(*)::bigint as violations
from public.product_images pi
left join public.products p on p.id = pi.product_id
where pi.product_id is not null and p.id is null;
SQL
