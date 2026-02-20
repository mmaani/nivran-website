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
10. `patches/010_promotions_targeting_and_code_nullability.sql`
11. `patches/011_variants_tags_promotions_orders.sql`
12. `patches/012_free_shipping_default_69.sql`
13. `patches/013_neon_catalog_recovery_bundle.sql`

Apply in numeric order for a fresh environment.
