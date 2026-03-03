# Archive/Rename Next Steps (Done-in-one workflow)

## Current source-of-truth artifacts
- `table_usage_matrix.csv`
- `tables_keep.txt`
- `tables_archive_candidates.txt`
- `tables_drop_later.txt`
- `preview_archive_rename.sql`
- `preview_rollback.sql`
- `production_archive_rename.sql`
- `production_rollback.sql`

## What was verified now
1. Lint/build pass in current code state.
2. Analytics injection remains production-gated in `src/app/layout.tsx`.
3. No TypeScript `any` was introduced in this run.
4. Preview/prod SQL are rename-only (no DROP statements).

## Execution order (manual DBA/operator step)
1. Run `preview_archive_rename.sql` against PREVIEW only.
2. Smoke-check runtime flows in preview:
   - storefront browse/cart/checkout
   - auth login/signup/reset
   - admin orders/refunds/inventory
3. If any issue appears, run `preview_rollback.sql` in PREVIEW.
4. If preview is healthy and approved, schedule production window.
5. Run `production_archive_rename.sql` in PROD.
6. Monitor errors/logs; if needed run `production_rollback.sql`.

## Notes
- No tables were dropped.
- `tables_drop_later.txt` is intentionally deferred until post-archive observation period.


## Re-run the SQL audit safely (fix for `db_full_audit.sql: No such file or directory`)
Use the wrapper so path resolution is stable even if your shell cwd changes:

```bash
DATABASE_URL_UNPOOLED="<preview-db-url>" bash scripts/run-db-full-audit.sh
```

This executes `${REPO_ROOT}/db_full_audit.sql` and writes output to `audit_outputs/db_full_audit_output.txt`.
