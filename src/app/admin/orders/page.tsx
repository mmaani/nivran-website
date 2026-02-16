import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import OrdersClient from "./ui";
import { adminT, getAdminLang } from "@/lib/admin-lang";


// ...existing code...
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

  const [hasPaymentMethod, hasTranRef] = await Promise.all([
    hasColumn("payment_method"),
    hasColumn("paytabs_tran_ref"),
  ]);

  const paymentMethodSelect = hasPaymentMethod ? "payment_method" : "'PAYTABS'::text as payment_method";
  const tranRefSelect = hasTranRef ? "paytabs_tran_ref" : "null::text as paytabs_tran_ref";

  const { rows } = await db.query<OrdersRow>(
    `select id, cart_id, status, amount, currency, locale,
            ${paymentMethodSelect},
            ${tranRefSelect},
            created_at, customer, shipping
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

      <OrdersClient initialRows={rows as OrdersRow[]} lang={lang} />
    </div>
  );
}
