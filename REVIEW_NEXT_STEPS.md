# Review next steps (status)

## Completed in latest batches ✅

1. **Inactive buy-now protection**
   - `product-by-slug` rejects inactive products as `404`.
   - Checkout buy-now path handles non-OK payloads and shows unavailable message.

2. **Catalog API resilience alignment**
   - Catalog read routes use `ensureCatalogTablesSafe()` and return explicit fallback/degraded response payloads.

3. **Shipping default consistency**
   - Shipping defaults are sourced from shared shipping helpers/constants used by both shipping config and order creation flow.

4. **Regression contract coverage**
   - Added and enforced via `ci:guard`:
     - `check:buy-now-inactive-contract`
     - `check:orders-create-contract`
     - `check:reorder-cart-contract`

5. **Optional hardening batch completed**
   - Added automated monitor smoke script: `pnpm monitor:critical-endpoints`.
   - Removed admin-shell lint debt (unused keydown handler).

## Current pending items

- No blocking functional tasks currently tracked.
- Optional future improvements:
  - wire `monitor:critical-endpoints` into external scheduler/cron for periodic alerts.
  - add true DB-mocked integration tests once a dedicated test harness is introduced.
