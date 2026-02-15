import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { ensureCatalogTables } from "@/lib/catalog";
import { getCustomerIdFromRequest } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHIPPING_JOD = 3.5;
const FALLBACK_ITEM_PRICE_JOD = 18.0;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeDiscountedPrice(base: number, promo: any | null): number {
  if (!promo) return base;
  const t = String(promo.discount_type || "").toUpperCase();
  const v = Number(promo.discount_value || 0);
  if (!Number.isFinite(v) || v <= 0) return base;

  let discount = 0;
  if (t === "PERCENT") discount = base * (v / 100);
  else if (t === "FIXED") discount = v;

  return round2(Math.max(0, base - discount));
}

async function fetchProductBySlug(slug: string) {
  const r = await db.query(
    `select id, slug, name_en, name_ar, price_jod, category_key, is_active
       from products
      where slug=$1
      limit 1`,
    [slug]
  );
  const p = r.rows[0] as any;
  if (!p || !p.is_active) return null;
  return p;
}

async function fetchActivePromoForCategory(categoryKey: string) {
  const r = await db.query(
    `select id, code, title_en, title_ar, discount_type, discount_value, category_keys
       from promotions
      where is_active=true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and (
          category_keys is null
          or array_length(category_keys, 1) is null
          or $1 = any(category_keys)
        )
      order by created_at desc
      limit 1`,
    [categoryKey]
  );
  return (r.rows[0] as any) || null;
}

export async function POST(req: Request) {
  await ensureOrdersTables();
  await ensureCatalogTables();

  try {
    const body = await req.json();

    const locale = String(body?.locale || "en");
    const paymentMethod = String(body?.paymentMethod || "PAYTABS").toUpperCase();
    const qty = Math.max(1, Number(body?.qty || 1));

    const customer = body?.customer || {};
    const shipping = body?.shipping || {};

    const customerName = String(customer?.name || "").trim();
    const customerEmail = String(customer?.email || "").trim() || null;
    const customerPhone = String(customer?.phone || "").trim();

    const address = String(shipping?.address || "").trim();
    const city = String(shipping?.city || "").trim();
    const country = String(shipping?.country || "").trim();

    if (!customerName || !customerPhone || !address || !city || !country) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    // Optional product selection (single item order)
    const productSlug = String(body?.productSlug || "").trim();
    const product = productSlug ? await fetchProductBySlug(productSlug) : null;

    const baseUnit = product?.price_jod ? Number(product.price_jod) : FALLBACK_ITEM_PRICE_JOD;
    const categoryKey = String(product?.category_key || "perfume");
    const promo = product ? await fetchActivePromoForCategory(categoryKey) : null;
    const unit = computeDiscountedPrice(baseUnit, promo);

    const items = [
      {
        product_id: product?.id || null,
        slug: product?.slug || productSlug || null,
        name_en: product?.name_en || null,
        name_ar: product?.name_ar || null,
        category_key: categoryKey,
        qty,
        unit_price_jod: round2(unit),
        base_unit_price_jod: round2(baseUnit),
        promo: promo
          ? {
              id: promo.id,
              code: promo.code,
              discount_type: promo.discount_type,
              discount_value: Number(promo.discount_value),
            }
          : null,
      },
    ];

    const subtotal = round2(unit * qty);
    const total = round2(subtotal + SHIPPING_JOD);

    const cartId = `NIVRAN-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const status =
      paymentMethod === "COD" ? "PENDING_COD_CONFIRM" : "PENDING_PAYMENT";

    const customerId = await getCustomerIdFromRequest(req).catch(() => null);

    await db.query(
      `insert into orders
        (cart_id, status, amount, currency, locale, payment_method, customer, shipping, items, customer_name, customer_email, customer_id, created_at, updated_at)
       values
        ($1,$2,$3,'JOD',$4,$5,$6,$7,$8,$9,$10,$11, now(), now())`,
      [
        cartId,
        status,
        total,
        locale,
        paymentMethod,
        JSON.stringify({ name: customerName, email: customerEmail, phone: customerPhone }),
        JSON.stringify({ address, city, country, shipping_jod: SHIPPING_JOD }),
        JSON.stringify({ items, subtotal_jod: subtotal, shipping_jod: SHIPPING_JOD, total_jod: total }),
        customerName,
        customerEmail,
        customerId,
      ]
    );

    return NextResponse.json({ ok: true, cartId, status });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Order create failed" }, { status: 500 });
  }
}
