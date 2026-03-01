# Production hardening checklist — NIVRAN

## Payments & refunds
- PayTabs callback and query endpoints are non-public or rate-limited.
- Callback validation:
  - Validate signature if available.
  - If signature is not available, enforce strict allowlist of fields + audit payload storage.
- Refunds are idempotent:
  - DB unique constraint: `refunds(order_id, idempotency_key)`.
- Refund flow controls:
  - Never allow PAID/PROCESSING/SHIPPED/DELIVERED -> FAILED/CANCELED when `inventory_committed_at` is set.
  - Use refund statuses: `REFUND_REQUESTED / REFUND_PENDING / REFUNDED / REFUND_FAILED`.
- Restock is delayed and job-based:
  - Restock only through `restock_jobs`.
  - Runner uses `FOR UPDATE SKIP LOCKED`.
  - Job marks DONE only after inventory update succeeds.
  - Runner is safe to run concurrently.

## Inventory safety
- Inventory commit for paid orders:
  - Uses row locks on products.
  - Fails closed if product resolution missing.
  - No oversell “fixes” that hide problems.
- Restock uses order items and increments exactly once per job.

## Security
- Admin endpoints require secure cookie-based auth.
- Add CSRF protection for state-changing admin POST endpoints.
- Rate-limit auth and admin mutation endpoints.
- BASE_URL and callback URLs come from config, not request headers.
- Never print secrets or full tokens in logs.

## Observability
- Monitoring dashboard exists and is admin-only.
- Log PayTabs refund requests with:
  - order_id, cart_id, tran_ref, refund_id, and a request id
- Alert criteria to watch:
  - paid-but-not-committed > 0
  - refunds FAILED spikes
  - restock_jobs backlog growing

## Ops & data
- Neon backups enabled and verified.
- Schema changes:
  - Prefer additive migrations + stabilizers.
  - Keep migrations tracked and reviewed.
- Avoid DDL on request path in production if possible (run migrations during deploy).