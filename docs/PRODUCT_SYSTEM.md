# PRODUCT_SYSTEM

## Product Model Scope
This repo manages Nivran product catalog data and operational product workflows, including:
- products and variants
- categories
- promotions/discount behavior
- product media retrieval
- inventory quantities and inventory commit/reconcile flows

## Related Repo Areas
- Admin catalog/inventory UI and APIs under `src/app/admin/catalog` and `src/app/admin/inventory`
- Catalog APIs under `src/app/api/catalog`
- Core catalog/order/inventory logic under `src/lib/catalog*` and `src/lib/orders.ts`
- Migrations and supporting scripts in `migrations/` and `scripts/`

## Constraints
- Changes must preserve checkout/order invariants.
- Inventory updates must remain idempotent and auditable.
- Product system decisions must stay within Nivran scope only.
