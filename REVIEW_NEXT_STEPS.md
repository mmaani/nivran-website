# Review next steps (status)

## Completed in latest batch ✅

1. **Inactive buy-now protection**
   - `product-by-slug` rejects inactive products as `404`.
   - Checkout buy-now path handles non-OK payloads and shows unavailable message.

2. **Catalog API resilience alignment**
   - Catalog read routes use `ensureCatalogTablesSafe()` and return explicit fallback/degraded response payloads.

3. **Shipping default consistency**
   - Shipping default source is unified through shared shipping helpers/constants used by both shipping config and order creation flow.

4. **Regression contract coverage added**
   - Added `check:buy-now-inactive-contract` and included it in `ci:guard`.

5. **Lint hygiene**
   - Removed unused `onDocKeyDown` handler in admin shell.

## Remaining suggestions (optional)

- Add runtime integration tests around `/api/orders` create path using a mock DB adapter.
- Add end-to-end test for account reorder -> cart (`add` and `replace`) in CI.
- Add synthetic monitoring for `/api/catalog/product-by-slug` and `/api/orders` health.
