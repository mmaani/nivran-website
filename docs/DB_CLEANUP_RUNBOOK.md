# DB Cleanup Runbook (Preview Aligned, Production Pending)

## Scope
- Archive-first cleanup only.
- No `DROP TABLE` in this run.
- Preview and production are handled separately with separate unpooled URLs.

## Evidence Snapshot (2026-03-03 UTC)
- Candidate rename set:
  - `email_send_log` (`ARCHIVE_CANDIDATE`: not referenced in code, has rows)
  - `coupons` (`DROP_LATER`: not referenced in code, 0 rows, no FKs)
- Keep set includes all runtime and FK-connected tables (see `audit_outputs/tables_keep.txt`).

## Preview Execution (Already Completed)
Use `DATABASE_URL_UNPOOLED` only.

```bash
URL="$DATABASE_URL_UNPOOLED"
case "$URL" in
  *sslrootcert=*) ;;
  *) URL="$URL&sslrootcert=system" ;;
esac

psql "$URL" -X -v ON_ERROR_STOP=1 -f audit_outputs/preview_archive_rename.sql
psql "$URL" -X -v ON_ERROR_STOP=1 -f audit_outputs/preview_post_rename_checks.sql
```

Rollback command:

```bash
URL="$DATABASE_URL_UNPOOLED"
case "$URL" in
  *sslrootcert=*) ;;
  *) URL="$URL&sslrootcert=system" ;;
esac

psql "$URL" -X -v ON_ERROR_STOP=1 -f audit_outputs/preview_rollback.sql
```

## Production Window Plan (Do Not Execute Until GO)
Use `PRODUCTION_DATABASE_URL_UNPOOLED` only.

```bash
URL="$PRODUCTION_DATABASE_URL_UNPOOLED"
case "$URL" in
  *sslrootcert=*) ;;
  *) URL="$URL&sslrootcert=system" ;;
esac

psql "$URL" -X -v ON_ERROR_STOP=1 -f audit_outputs/prod_archive_rename.sql
psql "$URL" -X -v ON_ERROR_STOP=1 -f audit_outputs/preview_post_rename_checks.sql
```

Production rollback:

```bash
URL="$PRODUCTION_DATABASE_URL_UNPOOLED"
case "$URL" in
  *sslrootcert=*) ;;
  *) URL="$URL&sslrootcert=system" ;;
esac

psql "$URL" -X -v ON_ERROR_STOP=1 -f audit_outputs/prod_rollback.sql
```

## Post-Run Verification Checklist
- Storefront `/en/product` loads and lists products.
- Cart flow works (add/remove/update).
- Checkout flow works to order placement.
- Admin login succeeds.
- Admin orders list loads.
- Promo apply/remove works.
- PayTabs callback endpoint `/api/paytabs/callback` accepts callback and logs to `paytabs_callbacks`.

## Category Key Canonicalization Plan (Hyphen Canonical)
Canonical rule: category keys must be lowercase kebab-case (hyphen), never underscore.

Current preview evidence (`audit_outputs/category_key_audit.txt`):
- Existing keys are already hyphen-only.
- No underscore/hyphen duplicate pairs currently exist.

Safe migration path (preview first, then production):
1. Create mapping table for backward compatibility:
   - `category_key_aliases(alias_key text primary key, canonical_key text not null references categories(key))`
2. Backfill aliases for known underscore forms (`air_freshener -> air-freshener`, etc.).
3. Canonicalize data writes:
   - Update admin/API write paths to normalize input keys via `replace(lower(trim(key)), '_', '-')`.
4. Data migration SQL (preview first):
   - Update `products.category_key` and `promotions.category_keys` to canonical values.
5. Compatibility reads:
   - Resolve incoming key through alias mapping before querying categories/products.
6. After 1 release cycle without underscore writes, remove unused aliases.

## No-Drop Policy and Observation Period
- Observation period: 14 days after production rename.
- During this period, keep archived tables intact.
- Collect evidence:
  - No runtime errors referencing archived table names.
  - No query logs touching archived names.
  - Verification checklist remains green.

## Deferred Drop Plan (Not Executed)
Candidate archived tables after observation period:
- `coupons_archive_20260303`
- `email_send_log_archive_20260303`

Required evidence before drop:
- 14-day clean application logs.
- 14-day clean DB query logs for archived names.
- Confirmed successful storefront/admin/checkout/payments callbacks.

Commented SQL for future window:

```sql
-- BEGIN;
-- DROP TABLE IF EXISTS public.coupons_archive_20260303;
-- DROP TABLE IF EXISTS public.email_send_log_archive_20260303;
-- COMMIT;
```
