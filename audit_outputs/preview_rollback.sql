BEGIN;

-- Rollback for preview_archive_rename.sql
ALTER TABLE public.email_send_log_archive_20260303 RENAME TO email_send_log;
ALTER TABLE public.coupons_archive_20260303 RENAME TO coupons;
ALTER TABLE public.shipments_archive_20260303 RENAME TO shipments;
ALTER TABLE public.product_media_archive_20260303 RENAME TO product_media;
ALTER TABLE public.order_refunds_archive_20260303 RENAME TO order_refunds;
ALTER TABLE public.batches_archive_20260303 RENAME TO batches;

COMMIT;
