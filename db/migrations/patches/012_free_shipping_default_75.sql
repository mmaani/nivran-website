-- Patch: set default free shipping threshold to 75 JOD (idempotent)

insert into store_settings (key, value_number, updated_at)
values ('free_shipping_threshold_jod', 75, now())
on conflict (key) do update
set value_number = excluded.value_number,
    updated_at = excluded.updated_at
where store_settings.key = 'free_shipping_threshold_jod'
  and (store_settings.value_number is null
       or store_settings.value_number = 75
       or store_settings.value_number = 0);
