// src/app/admin/orders/page.tsx
import "server-only";

import { db } from "@/lib/db";
import { ensureOrdersTablesSafe } from "@/lib/orders";
import OrdersClient from "./ui";
import { adminT, getAdminLang } from "@/lib/admin-lang";
import { requireAdmin } from "@/lib/guards";
import { cookies } from "next/headers";

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
  discount_source: string | null;
  promo_code: string | null;
  promotion_id: string | null;
  promo_consumed: boolean | null;
  promo_consume_failed: boolean | null;
  promo_consume_error: string | null;
  last_refund_id: number | null;
  last_refund_status: string | null;
  last_refund_method: string | null;
  last_refund_amount_jod: string | null;
  last_refund_requested_at: string | null;
  last_refund_succeeded_at: string | null;
  last_refund_failed_at: string | null;
  last_refund_error: string | null;
};

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  const parts: string[] = [];
  for (const item of c.getAll()) parts.push(`${item.name}=${item.value}`);
  return parts.join("; ");
}

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
  const req = new Request("http://local.admin/admin/orders", {
    headers: { cookie: await cookieHeader() },
  });

  const auth = requireAdmin(req);
  if (!auth.ok) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Admin — Orders</h1>
        <p>Unauthorized</p>
      </main>
    );
  }

  await ensureOrdersTablesSafe();

  const lang = await getAdminLang();
  const t = adminT(lang);

  const [hasPaymentMethod, hasTranRef, hasItems, hasTotals, hasPromoMeta] = await Promise.all([
    hasColumn("payment_method"),
    hasColumn("paytabs_tran_ref"),
    hasColumn("items"),
    hasColumn("total_jod"),
    hasColumn("discount_source"),
  ]);

  const paymentMethodSelect = hasPaymentMethod ? "o.payment_method" : "'PAYTABS'::text as payment_method";
  const tranRefSelect = hasTranRef ? "o.paytabs_tran_ref" : "null::text as paytabs_tran_ref";
  const itemsSelect = hasItems ? "o.items" : "'[]'::jsonb as items";
  const subtotalSelect = hasTotals ? "o.subtotal_before_discount_jod::text" : "null::text as subtotal_before_discount_jod";
  const discountSelect = hasTotals ? "o.discount_jod::text" : "null::text as discount_jod";
  const shippingSelect = hasTotals ? "o.shipping_jod::text" : "null::text as shipping_jod";
  const totalSelect = hasTotals ? "o.total_jod::text" : "null::text as total_jod";

  const discountSourceSelect = hasPromoMeta ? "o.discount_source::text" : "null::text as discount_source";
  const promoCodeSelect = hasPromoMeta ? "o.promo_code::text" : "null::text as promo_code";
  const promotionIdSelect = hasPromoMeta ? "o.promotion_id::text" : "null::text as promotion_id";
  const promoConsumedSelect = hasPromoMeta ? "o.promo_consumed" : "false as promo_consumed";
  const promoConsumeFailedSelect = hasPromoMeta ? "o.promo_consume_failed" : "false as promo_consume_failed";
  const promoConsumeErrorSelect = hasPromoMeta ? "o.promo_consume_error::text" : "null::text as promo_consume_error";

  const { rows } = await db.query<OrdersRow>(
    `select o.id, o.cart_id, o.status, o.amount, o.currency, o.locale,
            ${paymentMethodSelect},
            ${tranRefSelect},
            o.created_at,
            coalesce(o.customer, jsonb_build_object('name', o.customer_name, 'phone', o.customer_phone, 'email', o.customer_email)) as customer,
            coalesce(o.shipping, jsonb_build_object('city', o.shipping_city, 'address', o.shipping_address, 'country', o.shipping_country)) as shipping,
            ${itemsSelect},
            ${subtotalSelect},
            ${discountSelect},
            ${shippingSelect},
            ${totalSelect},
            ${discountSourceSelect},
            ${promoCodeSelect},
            ${promotionIdSelect},
            ${promoConsumedSelect},
            ${promoConsumeFailedSelect},
            ${promoConsumeErrorSelect},
            r.id::int as last_refund_id,
            r.status::text as last_refund_status,
            r.method::text as last_refund_method,
            r.amount_jod::text as last_refund_amount_jod,
            r.requested_at::text as last_refund_requested_at,
            r.succeeded_at::text as last_refund_succeeded_at,
            r.failed_at::text as last_refund_failed_at,
            r.last_error::text as last_refund_error
      from orders o
      left join lateral (
        select id, status, method, amount_jod, requested_at, succeeded_at, failed_at, last_error
          from refunds
         where order_id = o.id
         order by id desc
         limit 1
      ) r on true
      order by o.created_at desc
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
