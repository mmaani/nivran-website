import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import OrdersClient from "./ui";
import { adminT, getAdminLang } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrdersRow = {
  id: number;
  cart_id: string;
  status: string;
  amount: string;
  currency: string;
  locale: string;
  payment_method: string;
  paytabs_tran_ref: string | null;
  created_at: string;
  customer: unknown;
  shipping: unknown;
  items: unknown;
  subtotal_before_discount_jod: string | null;
  discount_jod: string | null;
  shipping_jod: string | null;
  total_jod: string | null;
};

async function hasColumn(columnName: string): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    `select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = $1
    ) as exists`,
    [columnName]
  );
  return Boolean(rows[0]?.exists);
}

export default async function AdminOrdersPage() {
  await ensureOrdersTables();

  const lang = await getAdminLang();
  const t = adminT(lang);

  const [hasPaymentMethod, hasTranRef, hasItems, hasTotals] = await Promise.all([
    hasColumn("payment_method"),
    hasColumn("paytabs_tran_ref"),
    hasColumn("items"),
    hasColumn("total_jod"),
  ]);

  const paymentMethodSelect = hasPaymentMethod ? "payment_method" : "'PAYTABS'::text as payment_method";
  const tranRefSelect = hasTranRef ? "paytabs_tran_ref" : "null::text as paytabs_tran_ref";
  const itemsSelect = hasItems ? "items" : "'[]'::jsonb as items";
  const subtotalSelect = hasTotals ? "subtotal_before_discount_jod::text" : "null::text as subtotal_before_discount_jod";
  const discountSelect = hasTotals ? "discount_jod::text" : "null::text as discount_jod";
  const shippingSelect = hasTotals ? "shipping_jod::text" : "null::text as shipping_jod";
  const totalSelect = hasTotals ? "total_jod::text" : "null::text as total_jod";

  const { rows } = await db.query<OrdersRow>(
    `select id, cart_id, status, amount, currency, locale,
            ${paymentMethodSelect},
            ${tranRefSelect},
            created_at,
            coalesce(customer, jsonb_build_object('name', customer_name, 'phone', customer_phone, 'email', customer_email)) as customer,
            coalesce(shipping, jsonb_build_object('city', shipping_city, 'address', shipping_address, 'country', shipping_country)) as shipping,
            ${itemsSelect},
            ${subtotalSelect},
            ${discountSelect},
            ${shippingSelect},
            ${totalSelect}
     from orders
     order by created_at desc
     limit 200`
  );

  const hint =
    lang === "ar"
      ? "قواعد الحالة: يجب أن تكون PayTabs «PAID» قبل الشحن؛ والدفع عند الاستلام يستخدم: PENDING_COD_CONFIRM → PROCESSING → SHIPPED → DELIVERED → PAID_COD."
      : "Status guardrails: PayTabs must be PAID before SHIPPING; COD uses PENDING_COD_CONFIRM → PROCESSING → SHIPPED → DELIVERED → PAID_COD.";

  return (
    <div className="admin-grid">
      <div>
        <h1 className="admin-h1">{t("orders")}</h1>
        <p className="admin-muted">{hint}</p>
      </div>

      <OrdersClient initialRows={rows} lang={lang} />
    </div>
  );
}
