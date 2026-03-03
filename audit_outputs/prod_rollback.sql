BEGIN;
ALTER TABLE public.coupons_archive_20260303 RENAME TO coupons;
ALTER TABLE public.email_send_log_archive_20260303 RENAME TO email_send_log;
COMMIT;
