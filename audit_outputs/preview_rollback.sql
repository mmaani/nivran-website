BEGIN;

ALTER TABLE public.batches_archive_20260303 RENAME TO batches;
ALTER TABLE public.coupons_archive_20260303 RENAME TO coupons;
ALTER TABLE public.customer_cart_items_archive_20260303 RENAME TO customer_cart_items;
ALTER TABLE public.customer_carts_archive_20260303 RENAME TO customer_carts;
ALTER TABLE public.email_send_log_archive_20260303 RENAME TO email_send_log;
ALTER TABLE public.order_refunds_archive_20260303 RENAME TO order_refunds;
ALTER TABLE public.password_reset_tokens_archive_20260303 RENAME TO password_reset_tokens;
ALTER TABLE public.payments_archive_20260303 RENAME TO payments;
ALTER TABLE public.product_media_archive_20260303 RENAME TO product_media;
ALTER TABLE public.shipments_archive_20260303 RENAME TO shipments;

COMMIT;
