import { NextResponse } from "next/server";
import crypto from "crypto";
import { db, type DbExecutor } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";
import { evaluatePromoCodeForLines, type PricedOrderLine } from "@/lib/promotions";
import { hashPassword } from "@/lib/identity";

type CheckoutItem = { productId: number; qty: number };
type CheckoutBody = {
  items: CheckoutItem[];
  promoCode?: string;
  paymentMethod?: "CARD_ONLINE" | "CARD_POS" | "CASH";
  customer: { name: string; email: string; phone: string; city: string; address: string; country?: string };
  createAccount?: boolean;
  accountPassword?: string;
};

export const runtime = "nodejs";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
  const auth = requireAdminOrSales(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as CheckoutBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, error: "No items" }, { status: 400 });
  }

  const customerEmail = String(body.customer?.email || "").trim().toLowerCase();
  if (!customerEmail) return NextResponse.json({ ok: false, error: "Customer email required" }, { status: 400 });

  const productIds = Array.from(new Set(body.items.map((line) => Number(line.productId)).filter((n) => Number.isFinite(n) && n > 0)));

  const response = await db.withTransaction(async (trx) => {
    const productsRes = await trx.query<{ id: number; slug: string; name_en: string; category_key: string | null; price_jod: string; inventory_qty: number }>(
      `select id, slug, name_en, category_key, price_jod::text, inventory_qty
         from products
        where id = any($1::bigint[])
        for update`,
      [productIds]
    );

    const productMap = new Map(productsRes.rows.map((row) => [row.id, row]));

    const lines: Array<PricedOrderLine & { product_id: number; unit_price_jod: number; requested_qty: number; fulfilled_qty: number; backorder_qty: number }> = [];
    for (const item of body.items) {
      const qty = Math.max(1, Math.trunc(Number(item.qty || 0)));
      const product = productMap.get(Number(item.productId));
      if (!product) return { ok: false as const, status: 400, error: `Product ${item.productId} not found` };
      const unit = Number(product.price_jod);
      const lineTotal = round2(unit * qty);
      const available = Math.max(0, Math.trunc(Number(product.inventory_qty || 0)));
      const fulfilledQty = Math.min(available, qty);
      const backorderQty = qty - fulfilledQty;
      lines.push({
        product_id: product.id,
        qty,
        requested_qty: qty,
        fulfilled_qty: fulfilledQty,
        backorder_qty: backorderQty,
        slug: product.slug,
        category_key: product.category_key,
        unit_price_jod: unit,
        line_total_jod: lineTotal,
      });
    }

    const subtotal = round2(lines.reduce((sum, line) => sum + line.line_total_jod, 0));
    const promoCode = String(body.promoCode || "").trim().toUpperCase();

    let discountJod = 0;
    let promotionId: number | null = null;
    if (promoCode) {
      const promo = await evaluatePromoCodeForLines(trx as unknown as DbExecutor, promoCode, lines, subtotal);
      if (!promo.ok) return { ok: false as const, status: 400, error: promo.error };
      discountJod = round2(promo.discountJod);
      promotionId = promo.promotionId;
    }

    let customerId: number | null = null;
    const existingCustomer = await trx.query<{ id: number }>(
      `select id from customers where lower(email)=lower($1) limit 1`,
      [customerEmail]
    ).catch(() => ({ rows: [] as Array<{ id: number }> }));

    if (existingCustomer.rows[0]?.id) {
      customerId = existingCustomer.rows[0].id;
    } else if (body.createAccount) {
      const password = String(body.accountPassword || "").trim();
      if (!password) return { ok: false as const, status: 400, error: "Account password required" };
      const passwordHash = await hashPassword(password);
      const created = await trx.query<{ id: number }>(
        `insert into customers (email, password_hash, full_name, phone, address_line1, city, country, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,true)
         returning id`,
        [
          customerEmail,
          passwordHash,
          String(body.customer.name || "").trim() || null,
          String(body.customer.phone || "").trim() || null,
          String(body.customer.address || "").trim() || null,
          String(body.customer.city || "").trim() || null,
          String(body.customer.country || "Jordan").trim() || "Jordan",
        ]
      );
      customerId = created.rows[0]?.id || null;
    }

    const hasBackorder = lines.some((line) => line.backorder_qty > 0);
    const status = hasBackorder ? "BACKORDER" : "PAID";
    const shippingJod = 0;
    const total = round2(subtotal - discountJod + shippingJod);
    const cartId = `sales_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    const inserted = await trx.query<{ id: number }>(
      `insert into orders (
        cart_id, status, amount, currency, locale, payment_method, customer_id,
        customer_name, customer_phone, customer_email,
        shipping_city, shipping_address, shipping_country,
        subtotal_before_discount_jod, discount_jod, subtotal_after_discount_jod, shipping_jod, total_jod,
        promo_code, promotion_id, discount_source,
        items, notes, created_at, updated_at, inventory_committed_at
      ) values (
        $1,$2,$3,'JOD','en',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,now(),now(),now()
      ) returning id`,
      [
        cartId,
        status,
        total,
        String(body.paymentMethod || "CARD_POS"),
        customerId,
        String(body.customer.name || "").trim(),
        String(body.customer.phone || "").trim(),
        customerEmail,
        String(body.customer.city || "").trim(),
        String(body.customer.address || "").trim(),
        String(body.customer.country || "Jordan").trim() || "Jordan",
        subtotal,
        discountJod,
        round2(subtotal - discountJod),
        shippingJod,
        total,
        promoCode || null,
        promotionId,
        promoCode ? "CODE" : null,
        JSON.stringify(lines.map((line) => ({ productId: line.product_id, requested_qty: line.requested_qty, fulfilled_qty: line.fulfilled_qty, backorder_qty: line.backorder_qty, slug: line.slug, unit_price_jod: line.unit_price_jod, line_total_jod: line.line_total_jod }))),
        hasBackorder ? "Contains backordered quantities" : null,
      ]
    );

    const orderId = inserted.rows[0]?.id;
    if (!orderId) return { ok: false as const, status: 500, error: "Failed to create order" };

    for (const line of lines) {
      if (line.fulfilled_qty > 0) {
        await trx.query(`update products set inventory_qty = greatest(0, inventory_qty - $1), updated_at=now() where id=$2`, [line.fulfilled_qty, line.product_id]);
      }
    }

    await trx.query(
      `insert into sales_audit_logs (order_id, actor_role, actor_staff_id, actor_username, action, payload)
       values ($1,$2,$3,$4,'CREATE_SALE',$5::jsonb)`,
      [
        orderId,
        auth.role,
        auth.staffId,
        auth.username,
        JSON.stringify({ total_jod: total, subtotal_jod: subtotal, discount_jod: discountJod, item_count: lines.length, has_backorder: hasBackorder }),
      ]
    );

    return { ok: true as const, status: 200, orderId, totalJod: total, statusCode: status };
  });

  if (!response.ok) return NextResponse.json({ ok: false, error: response.error }, { status: response.status });
  return NextResponse.json(response);
}
