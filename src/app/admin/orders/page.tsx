import { db } from "@/lib/db";
import OrdersClient from "./ui";

export const runtime = "nodejs";

export default async function AdminOrdersPage() {
  const pool = db();
  const { rows } = await pool.query(
    `select id, cart_id, status, amount, currency, locale, payment_method,
            paytabs_tran_ref, created_at, customer, shipping
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
