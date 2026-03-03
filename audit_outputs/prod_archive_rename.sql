BEGIN;
ALTER TABLE public.coupons RENAME TO coupons_archive_20260303;
ALTER TABLE public.email_send_log RENAME TO email_send_log_archive_20260303;
COMMIT;
