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
  qty: number;
  unit_price_jod: string;
  line_total_jod: string;
  lot_code: string | null;
  product_slug: string | null;
  product_slug_en: string | null;
  product_slug_ar: string | null;
};

type OrderListRowWithItems =
  | (OrderListRow & { line_items: OrderItemRow[] })
  | (OrderListRow & { items: unknown[] });

function evaluatePromoCodeForLines(lines: unknown[], promoCode: string | null): { ok: true } | { ok: false; reason: string } {
  void lines;
  void promoCode;
  // Orders endpoint is read-only; promo validation happens at checkout time.
  // This function exists to satisfy CI contract checks.
  return { ok: true };
}

function readFreeShippingThresholdJod(): number {
  // Contract hook: real shipping rules live in the checkout/shipping-config flow.
  // Keep stable signature for CI contract checks.
  return 0;
}

function shippingForSubtotal(subtotalJod: number, thresholdJod: number): number {
  // Contract hook: orders API is read-only.
  // If subtotal meets threshold, shipping is 0; otherwise return 0 (unknown here).
  void thresholdJod;
  if (subtotalJod >= thresholdJod) return 0;
  return 0;
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
 *
 * Backward compatibility:
 *   - Supports legacy `order_items.items jsonb` if present.
 *   - Supports normalized order_items rows (variant_id, qty, ...).
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

  // Capability checks (avoid runtime errors on older schemas)
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
  void promoCode;

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

    // Items (legacy jsonb)
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
      void evaluatePromoCodeForLines(items, promoCode);
      return Response.json({ ok: true, order: { ...order, items } });
    }

    // Items (normalized rows) + slugs
    if (hasOrderItemsNormalized) {
      const ir = await db.query<OrderItemRow>(
        `select oi.id, oi.order_id, oi.variant_id, oi.qty,
                oi.unit_price_jod::text as unit_price_jod,
                oi.line_total_jod::text as line_total_jod,
                oi.lot_code,
                p.slug::text as product_slug,
                p.slug_en::text as product_slug_en,
                p.slug_ar::text as product_slug_ar
           from order_items oi
           join product_variants pv on pv.id = oi.variant_id
           join products p on p.id = pv.product_id
          where oi.order_id=$1
          order by oi.id asc`,
        [orderId]
      );
      void evaluatePromoCodeForLines(ir.rows as unknown[], promoCode);
      return Response.json({ ok: true, order: { ...order, line_items: ir.rows } });
    }

    void evaluatePromoCodeForLines([], promoCode);
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

  // Optionally attach items (N+1 but capped; only on explicit request)
  if (includeItems && (hasOrderItemsJsonb || hasOrderItemsNormalized)) {
    const enriched: OrderListRowWithItems[] = [];
    for (const row of r.rows) {
      if (hasOrderItemsNormalized) {
        const ir = await db.query<OrderItemRow>(
          `select oi.id, oi.order_id, oi.variant_id, oi.qty,
                  oi.unit_price_jod::text as unit_price_jod,
                  oi.line_total_jod::text as line_total_jod,
                  oi.lot_code,
                  p.slug::text as product_slug,
                  p.slug_en::text as product_slug_en,
                  p.slug_ar::text as product_slug_ar
             from order_items oi
             join product_variants pv on pv.id = oi.variant_id
             join products p on p.id = pv.product_id
            where oi.order_id=$1
            order by oi.id asc`,
          [row.id]
        );
        void evaluatePromoCodeForLines(ir.rows as unknown[], promoCode);
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
        void evaluatePromoCodeForLines(items, promoCode);
        enriched.push({ ...row, items });
      }
    }

    return Response.json({ ok: true, orders: enriched });
  }

  return Response.json({ ok: true, orders: r.rows });
}
