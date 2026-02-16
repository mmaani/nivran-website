# NIVRAN website

NIVRAN / نيفـران storefront on Next.js App Router with Neon Postgres and PayTabs Hosted Payment Page (HPP).

## Local development

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env.local
   ```
3. Set required values in `.env.local`.
4. Run the app:
   ```bash
   pnpm dev
   ```
5. Build check:
   ```bash
   pnpm build
   ```

## Required environment variables (Vercel Preview + Production)

- `DATABASE_URL`
- `ADMIN_TOKEN`
- `PAYTABS_API_BASE_URL`
- `PAYTABS_PROFILE_ID`
- `PAYTABS_SERVER_KEY`
- `PAYTABS_CLIENT_KEY` (if used client-side)
- `APP_BASE_URL` (recommended; otherwise runtime origin is used)

If Vercel Deployment Protection is enabled on Preview, set `VERCEL_AUTOMATION_BYPASS_SECRET` and callbacks include `?x-vercel-protection-bypass=...` automatically.

## PayTabs flow overview

1. Order is created in `PENDING_PAYMENT` (PayTabs) or `PENDING_COD_CONFIRM` (COD).
2. `POST /api/paytabs/initiate` calls PayTabs `/payment/request`, stores `tran_ref`, and returns redirect URL.
3. Buyer is redirected to PayTabs Hosted Payment Page.
4. PayTabs sends server-to-server callback to `POST /api/paytabs/callback`.
   - Raw body is HMAC-verified using `PAYTABS_SERVER_KEY`.
   - Callback is always logged into `paytabs_callbacks`.
   - Only a valid callback can set payment state (`PAID` / `PAYMENT_FAILED` / `CANCELED`).
5. Return URL page is UI-only and never marks an order paid.
6. `POST|GET /api/paytabs/query` can reconcile status if callback is delayed/missing.

## Status model

- **PayTabs payment:** `PENDING_PAYMENT` → `PAID` / `PAYMENT_FAILED` / `CANCELED`
- **Fulfillment:** `PROCESSING` → `SHIPPED` → `DELIVERED`
- **COD:** `PENDING_COD_CONFIRM` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `PAID_COD`


## Preview verification runbook


### Getting your real Preview domain

Use the exact preview host from one of these places:

1. GitHub PR page → Vercel Preview check → open link and copy hostname.
2. Vercel Project → Deployments → latest Preview deployment URL.

Then run:

```bash
PREVIEW_DOMAIN=<actual-preview-host>.vercel.app ./scripts/verify-preview-paytabs.sh
```

If you see `DEPLOYMENT_NOT_FOUND`, the hostname is incorrect or deployment no longer exists.

### Helper scripts

```bash
# Verify branch/commit visibility from Codespaces
PR_BRANCH=work EXPECTED_COMMIT=29d5795 BASE_BRANCH=main ./scripts/verify-pr.sh

# Verify Preview PayTabs flow (smoke + initiate + query)
PREVIEW_DOMAIN=<actual-preview-host>.vercel.app ./scripts/verify-preview-paytabs.sh
```

- Initiate payment (replace `<preview-domain>`):
  - `https://<preview-domain>/api/paytabs/initiate`
- Callback endpoint:
  - `https://<preview-domain>/api/paytabs/callback`
- Query reconciliation endpoint:
  - `https://<preview-domain>/api/paytabs/query`

Example checks:

```bash
# 1) Create an order (example)
curl -sS -X POST "https://<preview-domain>/api/orders" \
  -H "content-type: application/json" \
  -d '{"mode":"PAYTABS","locale":"en","qty":1,"customer":{"name":"Test","phone":"0790000000"},"shipping":{"city":"Amman","address":"Street 1"}}'

# 2) Initiate PayTabs
curl -sS -X POST "https://<preview-domain>/api/paytabs/initiate" \
  -H "content-type: application/json" \
  -d '{"cartId":"<cart-id>","locale":"en"}'

# 3) Reconcile by cartId if callback is delayed
curl -sS "https://<preview-domain>/api/paytabs/query?cartId=<cart-id>"
```

Neon SQL verification:

```sql
select cart_id, status, payment_method, paytabs_tran_ref, updated_at
from orders
where cart_id = '<cart-id>';

select received_at, cart_id, tran_ref, signature_valid
from paytabs_callbacks
where cart_id = '<cart-id>'
order by received_at desc;
```

## Full updated package (what to check in Diff)

If you want to validate the end-to-end work quickly, these are the key areas/files usually touched:

- **Storefront checkout & account**: `src/app/(store)/[locale]/checkout/*`, `src/app/(store)/[locale]/account/*`
- **PayTabs APIs**: `src/app/api/paytabs/initiate/route.ts`, `src/app/api/paytabs/callback/route.ts`, `src/app/api/paytabs/query/route.ts`
- **Orders and status rules**: `src/app/api/orders/route.ts`, `src/lib/paytabs.ts`, `src/lib/orders.ts`
- **Admin order visibility**: `src/app/admin/orders/*`, `src/app/api/admin/orders/route.ts`, `src/app/api/admin/order-status/route.ts`
- **Admin auth/session**: `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/lib/guards.ts`, `src/middleware.ts`

## Payment UAT pass (real sandbox journey)

Use this script to run one full pass and produce a concrete `cartId` for auditing:

```bash
BASE_URL=https://<preview-domain> \
LOCALE=en \
ADMIN_TOKEN=<admin-token> \
./scripts/paytabs-uat.sh
```

What the script covers:
1. Create order with `mode=PAYTABS`.
2. Initiate payment and return the hosted `redirectUrl`.
3. Continue after callback stage (manual real callback, or automated simulation).
4. Reconcile via `GET /api/paytabs/query`.
5. Confirm order status from admin API (`/api/admin/orders`) when `ADMIN_TOKEN` is supplied.

### Optional callback simulation (for controlled verification)

When PayTabs callback delivery is delayed, you can still verify server transition logic end-to-end by posting a correctly signed callback:

```bash
BASE_URL=http://127.0.0.1:3000 \
ADMIN_TOKEN=$ADMIN_TOKEN \
PAYTABS_SERVER_KEY=$PAYTABS_SERVER_KEY \
SIMULATE_CALLBACK=1 \
./scripts/paytabs-uat.sh
```

This uses HMAC SHA-256 with header `x-paytabs-signature`, exactly like the server callback validator.



## Why some files may not appear in one PR diff

If your PR UI is showing only the latest incremental commit, earlier implementation files (for example `src/app/admin/inbox/InboxClient.tsx` or `src/app/admin/_components/AdminShell.tsx`) can be missed in that single comparison view.

Use this helper to see the **full package** across the target range:

```bash
BASE_COMMIT=72d66ca HEAD_COMMIT=HEAD ./scripts/show-full-package-diff.sh
```

You can also inspect a specific file history directly:

```bash
git log --oneline -- src/app/admin/inbox/InboxClient.tsx
git log --oneline -- src/app/admin/_components/AdminShell.tsx
```

## Pull this PR into `main` in Codespaces

From your Codespace terminal:

```bash
# 1) Ensure your working tree is clean
git status

# 2) Fetch latest refs
git fetch --all --prune

# 3) Switch to main and update it
git checkout main
git pull origin main

# 4) Merge this branch (example branch name: work)
git merge --no-ff work

# 5) Push merged main
git push origin main
```

If you want a fast-forward only (no merge commit), use:

```bash
git checkout main
git pull origin main
git merge --ff-only work
git push origin main
```

