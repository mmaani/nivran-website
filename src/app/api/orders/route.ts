import { db } from "@/lib/db";
import { ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";
import { ensureOrdersTables } from "@/lib/ordersSchema";
import { hasColumn } from "@/lib/dbSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders
 *   -> list latest orders for logged-in customer
 *
 * GET /api/orders?id=123
 *   -> single order + items (from order_items.items jsonb)
 */
export async function GET(req: Request) {
  await ensureIdentityTables();
  await ensureOrdersTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id");
  const orderId = idRaw ? Number(idRaw) : null;
  const wantOne = !!orderId && Number.isFinite(orderId) && orderId > 0;

  const hasTotalJod = await hasColumn("orders", "total_jod");

  if (wantOne) {
    const or = await db.query<{
      id: number;
      cart_id: string | null;
      status: string;
      amount_jod: string;
      created_at: string;
    }>(
      `select id, cart_id, status,
              ${hasTotalJod ? "coalesce(total_jod, amount)" : "amount"}::text as amount_jod,
              created_at::text as created_at
         from orders
        where id=$1 and customer_id=$2
        limit 1`,
      [orderId, customerId]
    );

    const order = or.rows[0];
    if (!order) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const ir = await db.query<{ items: unknown }>(
      `select items
         from order_items
        where order_id=$1
        order by id desc
        limit 1`,
      [orderId]
    );

    const items = Array.isArray(ir.rows[0]?.items) ? (ir.rows[0]!.items as unknown[]) : [];

    return Response.json({ ok: true, order: { ...order, items } });
  }

  const r = await db.query<{
    id: number;
    cart_id: string | null;
    status: string;
    amount_jod: string;
    created_at: string;
  }>(
    `select id, cart_id, status,
            ${hasTotalJod ? "coalesce(total_jod, amount)" : "amount"}::text as amount_jod,
            created_at::text as created_at
       from orders
      where customer_id=$1
      order by created_at desc
      limit 50`,
    [customerId]
  );

  return Response.json({ ok: true, orders: r.rows });
}
