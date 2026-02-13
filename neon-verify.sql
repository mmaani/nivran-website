select cart_id, status, payment_method, paytabs_tran_ref, updated_at
from orders
where cart_id = '<cart-id>';

select received_at, cart_id, tran_ref, signature_valid
from paytabs_callbacks
where cart_id = '<cart-id>'
order by received_at desc;
