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