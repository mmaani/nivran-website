import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import OrdersClient from "./ui";

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

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
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
  await ensureOrdersTables();

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

  return (
    <div className="admin-grid">
      <div className="admin-card">
        <h1 className="admin-h1">
          <T en="Orders" ar="الطلبات" />
        </h1>
        <p className="admin-muted">
          <T
            en="Guardrails: PayTabs must be PAID before SHIPPING. COD flow: PENDING_COD_CONFIRM → PROCESSING → SHIPPED → DELIVERED → PAID_COD."
            ar="ضوابط الحالة: يجب أن تكون PayTabs «مدفوع» قبل الشحن. مسار الدفع عند الاستلام: انتظار تأكيد الدفع → قيد المعالجة → تم الشحن → تم التسليم → مدفوع."
          />
        </p>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        <OrdersClient initialRows={rows} />
      </div>
    </div>
  );
}
