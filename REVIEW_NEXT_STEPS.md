# Review of current updated files: bugs and next Codex tasks

## Scope reviewed
- Focused on recent hardening paths around catalog fallback, checkout promo gating, and shipping/promo API interactions.
- Validation run:
  - `pnpm ci:guard`
  - `pnpm lint`
  - `pnpm build`

---

## High-priority bugs to fix

### 1) Inactive products can still be loaded by buy-now path
**Severity:** High  
**Why this matters:** `/api/catalog/product-by-slug` currently returns a product even when `is_active = false`, so a disabled product can still flow into checkout via `?slug=` buy-now.

**Evidence**
- Query selects `p.is_active`, but the route only checks for missing row (`if (!p)`), not inactive row.
- Checkout buy-now trusts this endpoint and builds a cart item from the response.

**Files to inspect/fix**
- `src/app/api/catalog/product-by-slug/route.ts`
- `src/app/(store)/[locale]/checkout/CheckoutClient.tsx` (only for defensive UX handling of 404/invalid response)

**Codex task (copy/paste):**
1. In `src/app/api/catalog/product-by-slug/route.ts`, reject inactive products with the same behavior as not found (404), e.g. `if (!p || !p.is_active) ...`.
2. Keep fallback behavior consistent: for DB connectivity fallback, ensure fallback products are considered active-only (or document static fallback assumption).
3. In checkout buy-now fetch flow, add explicit handling for non-OK responses to avoid silent no-op UX when product is unavailable.
4. Add/update test coverage (or minimal script) for inactive slug behavior and verify response code is 404.

**Acceptance criteria**
- Buy-now with inactive slug does not populate cart.
- API returns `404` for inactive slug.
- No regression in active slug behavior.

---

### 2) Catalog read APIs still hard-fail on recoverable catalog bootstrap errors
**Severity:** High  
**Why this matters:** Several read endpoints call `ensureCatalogTables()` directly and only fall back on DB connectivity errors. If DB user lacks DDL permission (or DB is read-only), these routes can throw 500 instead of degrading gracefully, despite the new `ensureCatalogTablesSafe()` helper.

**Evidence**
- `ensureCatalogTablesSafe()` exists specifically to return `{ ok: false, reason }` for recoverable setup issues.
- `product` and `product-by-slug` routes still call `ensureCatalogTables()` and only catch connectivity errors.

**Files to inspect/fix**
- `src/app/api/catalog/product/route.ts`
- `src/app/api/catalog/product-by-slug/route.ts`
- (Optionally audit all catalog read routes for same pattern)

**Codex task (copy/paste):**
1. Replace direct `ensureCatalogTables()` calls in catalog read APIs with `ensureCatalogTablesSafe()`.
2. If bootstrap result is not ok, return deterministic degraded response:
   - For list/detail routes with static fallback available: serve fallback payload with a marker (`fallback: true`, reason).
   - For routes without safe fallback: return 503 with machine-readable reason.
3. Preserve existing DB-connectivity fallback behavior, but unify error shape across routes.
4. Add regression checks for a simulated recoverable setup failure path (e.g. mocked helper returning `{ ok:false }`).

**Acceptance criteria**
- Read endpoints no longer throw 500 on recoverable catalog bootstrap errors.
- Degraded responses are explicit and consistent.
- Existing successful DB path remains unchanged.

---

### 3) Free-shipping default mismatch between checkout display and order finalization
**Severity:** Medium-High  
**Why this matters:** Checkout UI uses `/api/shipping-config` defaults of `35`, but order creation uses default `0` when DB setting is missing. This can produce mismatched totals (UI says free shipping unlocked; backend still charges shipping).

**Evidence**
- `/api/shipping-config`: defaults threshold to `35`.
- `/api/orders`: defaults threshold to `0`.

**Files to inspect/fix**
- `src/app/api/shipping-config/route.ts`
- `src/app/api/orders/route.ts`

**Codex task (copy/paste):**
1. Introduce a shared constant/helper for shipping defaults (threshold and base shipping) in `src/lib`.
2. Use that shared source in both `/api/shipping-config` and `/api/orders` so fallback and missing-setting behavior are identical.
3. Add one integration-level check (or scripted assertion) that same cart and same settings produce same shipping outcome in:
   - checkout displayed totals and
   - `/api/orders` persisted totals.

**Acceptance criteria**
- Default free-shipping threshold is consistent across UI and backend order calculation.
- No total mismatch when settings row is absent.

---

## Recommended implementation order
1. Fix inactive product leak (`product-by-slug`) first.
2. Unify safe bootstrap usage in catalog read APIs.
3. Consolidate shipping defaults with shared helper and regression check.

## Optional hardening follow-ups
- Add an internal response field for degraded mode (`fallback: true`, `reason`) wherever fallback payloads are served.
- Add endpoint-level contract tests for `ok/error/reason` shape consistency.
