# SECURITY_POLICY

## Secret Management Rules
- Secrets must never be committed to git.
- Secrets must never be hardcoded in source files.
- Secrets must never be printed in logs or docs.

## Allowed Secret Locations
- Hosting environment variables (for example Vercel project environment settings).
- Ignored local env files for development (`.env.local`, `.env.*.local`, or equivalent ignored files).

## Client-Bundle Safety
- Server-only secrets must never enter client bundles.
- Only intentionally public values may use `NEXT_PUBLIC_*`.
- Keep payment server keys, admin/session secrets, database URLs, and email API keys server-side only.

## Repo-Specific Secret/Config Inventory (From Code Inspection)
Sensitive server-side variables observed:
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED` (env template)
- `ADMIN_TOKEN`
- `ADMIN_SECRET`
- `ADMIN_SESSION_SECRET` (fallback path in code)
- `ORDER_STATUS_SECRET`
- `PAYTABS_SERVER_KEY`
- `PAYTABS_PROFILE_ID`
- `PAYTABS_API_BASE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`

Public/non-secret configuration observed:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_FLAT_SHIPPING_JOD`
- `NEXT_PUBLIC_WA_PHONE_E164`
- `NEXT_PUBLIC_WA_MESSAGE_TEMPLATE_ID`
- `NEXT_PUBLIC_WA_MESSAGE_TEMPLATE_NAME`
- `NEXT_PUBLIC_WA_MESSAGE_TEMPLATE_LANGUAGE`
- `APP_BASE_URL`
- `PAYTABS_CLIENT_KEY` (configured as publishable/client-side use when required by integration)

## Operational Guardrails
- Rotate any secret accidentally committed or exposed.
- Use placeholders only in `.env.example`.
- Validate that no `process.env` server secret reads are used in `"use client"` components.
- Keep `.gitignore` aligned with local env and artifact patterns.
