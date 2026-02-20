-- Promote legacy default free-shipping threshold from 35 -> 50 JOD.
-- We only auto-update when the value is still at legacy default (or null),
-- so custom merchant-configured thresholds remain untouched.

insert into store_settings (key, value_number, updated_at)
values ('free_shipping_threshold_jod', 50, now())
on conflict (key) do update
set value_number = 50,
    updated_at = now()
where store_settings.value_number is null
   or store_settings.value_number = 50;
