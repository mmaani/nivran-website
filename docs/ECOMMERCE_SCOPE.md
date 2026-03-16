# ECOMMERCE_SCOPE

## In Scope
- Storefront browsing and product detail pages.
- Cart and checkout flows.
- Order creation and status lifecycle.
- Payment integration and callback/query reconciliation (PayTabs).
- Admin order visibility and order-state operations.

## Related Repo Areas
- Storefront pages under `src/app/(store)/[locale]/...`
- Checkout/cart/account flows
- API routes under `src/app/api/orders` and `src/app/api/paytabs`
- Admin operational paths under `src/app/admin/...`

## Out of Scope
- Marketplace integrations (eBay or other external listing marketplaces).
- Non-Nivran commerce systems.
- Cross-project commerce modules from Zomorod or QuickAIBuy.
