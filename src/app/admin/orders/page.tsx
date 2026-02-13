import { db } from "@/lib/db";
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
  const [hasPaymentMethod, hasTranRef] = await Promise.all([
    hasColumn("payment_method"),
    hasColumn("paytabs_tran_ref"),
  ]);

  const paymentMethodSelect = hasPaymentMethod
    ? "payment_method"
    : "'PAYTABS'::text as payment_method";
  const tranRefSelect = hasTranRef
    ? "paytabs_tran_ref"
    : "null::text as paytabs_tran_ref";

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
    <div style={{ fontFamily: "system-ui", maxWidth: 1100, margin: "20px auto", padding: 18 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>NIVRAN Admin — Orders</h1>
        <form action="/api/admin/logout" method="post" style={{ marginInlineStart: "auto" }}>
          <button style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}>Logout</button>
        </form>
      </div>

      <p style={{ opacity: 0.7, marginTop: 8 }}>
        Status guardrails: PayTabs must be PAID before SHIPPING; COD uses PENDING_COD_CONFIRM → PROCESSING → SHIPPED → DELIVERED → PAID_COD.
      </p>

      <OrdersClient initialRows={rows} />
    </div>
  );
}
