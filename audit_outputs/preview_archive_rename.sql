BEGIN;

<<<<<<< codex/generate-database-usage-matrix-and-rename-scripts
-- Preview-safe archive renames (no DROPs).
ALTER TABLE public.batches RENAME TO batches_archive_20260303;
ALTER TABLE public.order_refunds RENAME TO order_refunds_archive_20260303;
ALTER TABLE public.product_media RENAME TO product_media_archive_20260303;
ALTER TABLE public.shipments RENAME TO shipments_archive_20260303;
ALTER TABLE public.coupons RENAME TO coupons_archive_20260303;
ALTER TABLE public.email_send_log RENAME TO email_send_log_archive_20260303;
=======
ALTER TABLE public.batches RENAME TO batches_archive_20260303;
ALTER TABLE public.coupons RENAME TO coupons_archive_20260303;
ALTER TABLE public.customer_cart_items RENAME TO customer_cart_items_archive_20260303;
ALTER TABLE public.customer_carts RENAME TO customer_carts_archive_20260303;
ALTER TABLE public.email_send_log RENAME TO email_send_log_archive_20260303;
ALTER TABLE public.order_refunds RENAME TO order_refunds_archive_20260303;
ALTER TABLE public.password_reset_tokens RENAME TO password_reset_tokens_archive_20260303;
ALTER TABLE public.payments RENAME TO payments_archive_20260303;
ALTER TABLE public.product_media RENAME TO product_media_archive_20260303;
ALTER TABLE public.shipments RENAME TO shipments_archive_20260303;
>>>>>>> main

COMMIT;
