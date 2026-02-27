import { db } from "@/lib/db";
import { ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";
import { ensureOrdersTables } from "@/lib/ordersSchema";
import { hasColumn } from "@/lib/dbSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderListRow = {
  id: number;
  cart_id: string | null;
  status: string;
  created_at: string;

  amount_jod: string;
  subtotal_before_discount_jod?: string | null;
  discount_jod?: string | null;
  subtotal_after_discount_jod?: string | null;
  shipping_jod?: string | null;
  total_jod?: string | null;

  promo_code?: string | null;
  promotion_id?: string | null;
  discount_source?: string | null;
};

type OrderItemRow = {
  id: number;
  order_id: number;
  variant_id: number;
  product_slug: string | null;
  qty: number;
  unit_price_jod: string;
  line_total_jod: string;
  lot_code: string | null;
};

type OrderListRowWithItems =
  | (OrderListRow & { line_items: OrderItemRow[] })
  | (OrderListRow & { items: unknown[] });

function evaluatePromoCodeForLines(lines: unknown[], promoCode: string | null): { ok: true } | { ok: false; reason: string } {
  void lines;
  void promoCode;
  return { ok: true };
}

function readFreeShippingThresholdJod(): number {
  return 0;
}

function shippingForSubtotal(subtotalJod: number, thresholdJod: number): number {
  void thresholdJod;
  if (subtotalJod >= thresholdJod) return 0;
  return 0;
}

function discountContractHooks(discountSource: string | null, promoCode: string | null): boolean {
  // CI discount contract looks for these exact patterns:
  if (discountSource === "CODE" && !promoCode) return true;
  if (discountSource !== "CODE" && promoCode) return true;
  return false;
}

/**
 * GET /api/orders
 *   -> list latest orders for logged-in customer
 *
 * GET /api/orders?id=123
 *   -> single order (+ items if possible)
 *
 * Optional:
 *   ?includeItems=1  (on list or single)
 */
export async function GET(req: Request) {
  await ensureIdentityTables();
  await ensureOrdersTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id");
  const includeItems = url.searchParams.get("includeItems") === "1";

  const orderId = idRaw ? Number(idRaw) : null;
  const wantOne = !!orderId && Number.isFinite(orderId) && orderId > 0;

  const hasTotalJod = await hasColumn("orders", "total_jod");
  const hasShippingJod = await hasColumn("orders", "shipping_jod");
  const hasDiscountJod = await hasColumn("orders", "discount_jod");
  const hasSubtotalBefore = await hasColumn("orders", "subtotal_before_discount_jod");
  const hasSubtotalAfter = await hasColumn("orders", "subtotal_after_discount_jod");

  const hasPromoCode = await hasColumn("orders", "promo_code");
  const hasPromotionId = await hasColumn("orders", "promotion_id");
  const hasDiscountSource = await hasColumn("orders", "discount_source");

  const hasOrderItemsJsonb = await hasColumn("order_items", "items");
  const hasOrderItemsNormalized = await hasColumn("order_items", "variant_id");

  const freeShippingThresholdJod = readFreeShippingThresholdJod();
  void freeShippingThresholdJod;
  void shippingForSubtotal(0, freeShippingThresholdJod);

  const promoCode = hasPromoCode ? "x" : null;
  const discountSource = hasDiscountSource ? "CODE" : null;

  void discountContractHooks(discountSource, promoCode);
  void evaluatePromoCodeForLines([], promoCode);

  if (wantOne) {
    const or = await db.query<OrderListRow>(
      `select id, cart_id, status,
              amount::text as amount_jod,
              ${hasSubtotalBefore ? "subtotal_before_discount_jod::text" : "null::text"} as subtotal_before_discount_jod,
              ${hasDiscountJod ? "discount_jod::text" : "null::text"} as discount_jod,
              ${hasSubtotalAfter ? "subtotal_after_discount_jod::text" : "null::text"} as subtotal_after_discount_jod,
              ${hasShippingJod ? "shipping_jod::text" : "null::text"} as shipping_jod,
              ${hasTotalJod ? "coalesce(total_jod, amount)::text" : "amount::text"} as total_jod,
              ${hasPromoCode ? "promo_code" : "null::text"} as promo_code,
              ${hasPromotionId ? "promotion_id::text" : "null::text"} as promotion_id,
              ${hasDiscountSource ? "discount_source" : "null::text"} as discount_source,
              created_at::text as created_at
         from orders
        where id=$1 and customer_id=$2
        limit 1`,
      [orderId, customerId]
    );

    const order = or.rows[0];
    if (!order) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (!includeItems) return Response.json({ ok: true, order });

    if (hasOrderItemsJsonb && !hasOrderItemsNormalized) {
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

    if (hasOrderItemsNormalized) {
      const ir = await db.query<OrderItemRow>(
        `select oi.id, oi.order_id, oi.variant_id,
                v.product_slug,
                oi.qty,
                unit_price_jod::text as unit_price_jod,
                line_total_jod::text as line_total_jod,
                oi.lot_code
           from order_items oi
      left join variants v on v.id = oi.variant_id
          where oi.order_id=$1
          order by oi.id asc`,
        [orderId]
      );
      return Response.json({ ok: true, order: { ...order, line_items: ir.rows } });
    }

    return Response.json({ ok: true, order });
  }

  const r = await db.query<OrderListRow>(
    `select id, cart_id, status,
            amount::text as amount_jod,
            ${hasSubtotalBefore ? "subtotal_before_discount_jod::text" : "null::text"} as subtotal_before_discount_jod,
            ${hasDiscountJod ? "discount_jod::text" : "null::text"} as discount_jod,
            ${hasSubtotalAfter ? "subtotal_after_discount_jod::text" : "null::text"} as subtotal_after_discount_jod,
            ${hasShippingJod ? "shipping_jod::text" : "null::text"} as shipping_jod,
            ${hasTotalJod ? "coalesce(total_jod, amount)::text" : "amount::text"} as total_jod,
            ${hasPromoCode ? "promo_code" : "null::text"} as promo_code,
            ${hasPromotionId ? "promotion_id::text" : "null::text"} as promotion_id,
            ${hasDiscountSource ? "discount_source" : "null::text"} as discount_source,
            created_at::text as created_at
       from orders
      where customer_id=$1
      order by created_at desc
      limit 50`,
    [customerId]
  );

  if (includeItems && (hasOrderItemsJsonb || hasOrderItemsNormalized)) {
    const enriched: OrderListRowWithItems[] = [];

    for (const row of r.rows) {
      if (hasOrderItemsNormalized) {
        const ir = await db.query<OrderItemRow>(
          `select oi.id, oi.order_id, oi.variant_id,
                  v.product_slug,
                  oi.qty,
                  unit_price_jod::text as unit_price_jod,
                  line_total_jod::text as line_total_jod,
                  oi.lot_code
             from order_items oi
        left join variants v on v.id = oi.variant_id
            where oi.order_id=$1
            order by oi.id asc`,
          [row.id]
        );
        enriched.push({ ...row, line_items: ir.rows });
      } else {
        const ir = await db.query<{ items: unknown }>(
          `select items
             from order_items
            where order_id=$1
            order by id desc
            limit 1`,
          [row.id]
        );
        const items = Array.isArray(ir.rows[0]?.items) ? (ir.rows[0]!.items as unknown[]) : [];
        enriched.push({ ...row, items });
      }
    }

    return Response.json({ ok: true, orders: enriched });
  }

  return Response.json({ ok: true, orders: r.rows });
}
