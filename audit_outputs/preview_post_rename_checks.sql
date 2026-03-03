-- Read-only post-rename checks for core runtime tables.
-- Expected: All queries should succeed and return non-error results.

select 'products' as table_name, count(*)::bigint as rows from public.products;
select 'categories' as table_name, count(*)::bigint as rows from public.categories;
select 'orders' as table_name, count(*)::bigint as rows from public.orders;
select 'customers' as table_name, count(*)::bigint as rows from public.customers;
select 'staff_users' as table_name, count(*)::bigint as rows from public.staff_users;
select 'payments' as table_name, count(*)::bigint as rows from public.payments;
select 'paytabs_callbacks' as table_name, count(*)::bigint as rows from public.paytabs_callbacks;
select 'promotions' as table_name, count(*)::bigint as rows from public.promotions;

-- FK integrity probes (should return 0 violations).
select 'orders_customer_fk_orphans' as check_name, count(*)::bigint as violations
from public.orders o
left join public.customers c on c.id = o.customer_id
where o.customer_id is not null and c.id is null;

select 'payments_order_fk_orphans' as check_name, count(*)::bigint as violations
from public.payments p
left join public.orders o on o.id = p.order_id
where p.order_id is not null and o.id is null;

select 'order_items_order_fk_orphans' as check_name, count(*)::bigint as violations
from public.order_items oi
left join public.orders o on o.id = oi.order_id
where oi.order_id is not null and o.id is null;

select 'order_items_variant_fk_orphans' as check_name, count(*)::bigint as violations
from public.order_items oi
left join public.variants v on v.id = oi.variant_id
where oi.variant_id is not null and v.id is null;

select 'product_images_product_fk_orphans' as check_name, count(*)::bigint as violations
from public.product_images pi
left join public.products p on p.id = pi.product_id
where pi.product_id is not null and p.id is null;
