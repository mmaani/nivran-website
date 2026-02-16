# Database migrations

This folder is the single place for SQL schema and patch scripts.

## Layout

- `core/` — baseline schema scripts.
- `patches/` — additive/fix patches applied after core.

## Current files

1. `core/001_schema.sql`
2. `patches/002_paytabs_callbacks.sql`
3. `patches/003_paytabs_patch.sql`
4. `patches/004_paytabs_callbacks_patch.sql`
5. `patches/005_cart_tables.sql`
6. `patches/006_account_checkout_patch.sql`
7. `patches/007_admin_paytabs_inbox_hardening.sql`
8. `patches/008_promo_checkout_patch.sql`
9. `patches/009_discount_mode_constraints.sql`

Apply in numeric order for a fresh environment.
