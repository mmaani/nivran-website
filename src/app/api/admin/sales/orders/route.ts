import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireAdminOrSales(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const auditMap = await db.query<{ order_id: number }>(
    `select distinct order_id from sales_audit_logs where action='CREATE_SALE' and order_id is not null ${auth.role === "sales" ? "and actor_staff_id=$1" : ""} order by order_id desc limit 200`,
    auth.role === "sales" ? [auth.staffId] : []
  ).catch(() => ({ rows: [] as Array<{ order_id: number }> }));

  const ids = auditMap.rows.map((row) => row.order_id).filter((id) => Number.isFinite(id));
  if (!ids.length) return NextResponse.json({ ok: true, orders: [] });

  const orders = await db.query(
    `select id, cart_id, status, payment_method, customer_name, customer_phone, customer_email, total_jod::text, created_at::text
       from orders
      where id = any($1::bigint[])
      order by created_at desc`,
    [ids]
  );

  return NextResponse.json({ ok: true, orders: orders.rows });
}
