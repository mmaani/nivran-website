import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { ensureCatalogTables } from "@/lib/catalog";
import { getCustomerIdFromRequest } from "@/lib/identity";

type PaymentMethod = "PAYTABS" | "COD";

type IncomingItem = {
  slug?: string;
  qty?: number;
  // client may send name/price but server will re-price from DB
  name?: string;
  priceJod?: number;
};

type CustomerInput = { name?: string; phone?: string; email?: string };
type ShippingInput = { city?: string; address?: string; notes?: string; country?: string };

type ProductRow = {
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  price_jod: string | number;
  category_key: string | null;
  is_active: boolean;
};

type OrderLine = {
  slug: string;
  name_en: string;
  name_ar: string;
  qty: number;
  unit_price_jod: number;
  line_total_jod: number;
  category_key: string | null;
};

async function fetchProductsBySlugs(slugs: string[]) {
  await ensureCatalogTables();
  const r = await db.query<ProductRow>(
    `select slug, name_en, name_ar, price_jod, category_key, is_active
       from products
      where slug = any($1::text[])`,
    [slugs]
  );
  return r.rows || [];
}

function normalizeItems(items: unknown): { slug: string; qty: number }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
    }))
    .filter((x) => !!x.slug);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureOrdersTables();

  const customerId = await getCustomerIdFromRequest(req).catch(() => null);

  const body: Record<string, unknown> | null = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const locale = body.locale === "ar" ? "ar" : "en";

  const paymentMethod: PaymentMethod =
    String(body.paymentMethod || body.mode || "").toUpperCase() === "COD" ? "COD" : "PAYTABS";

  const customer = (body.customer || {}) as CustomerInput;
  const shipping = (body.shipping || {}) as ShippingInput;

  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const email = String(customer.email || "").trim();
  const city = String(shipping.city || "").trim();
  const address = String(shipping.address || "").trim();
  const notes = String(shipping.notes || "").trim();
  const country = String(shipping.country || "Jordan").trim() || "Jordan";

  if (!name || !phone || !address || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة" : "Missing required fields" },
      { status: 400 }
    );
  }

  // Accept:
  // - multi-item: body.items[]
  // - legacy: body.productSlug + body.qty
  let items = normalizeItems(body.items);

  const legacySlug = String(body.productSlug || body.slug || "").trim();
  const legacyQty = Math.max(1, Math.min(99, Number(body.qty || 1)));

  if (!items.length && legacySlug) {
    items = [{ slug: legacySlug, qty: legacyQty }];
  }

  if (!items.length) {
    return NextResponse.json({ ok: false, error: locale === "ar" ? "لا توجد عناصر في السلة." : "No items" }, { status: 400 });
  }

  const slugs = Array.from(new Set(items.map((i) => i.slug)));
  const products = await fetchProductsBySlugs(slugs);

  const map = new Map<string, ProductRow>();
  for (const p of products) map.set(String(p.slug), p);

  // Build order lines with server pricing
  const lines: OrderLine[] = [];
  for (const it of items) {
    const p = map.get(it.slug);
    if (!p || !p.is_active) {
      return NextResponse.json({ ok: false, error: `Unknown or inactive product: ${it.slug}` }, { status: 400 });
    }
    const unit = Number(p.price_jod || 0);
    const qty = it.qty;
    lines.push({
      slug: it.slug,
      name_en: String(p.name_en || it.slug),
      name_ar: String(p.name_ar || p.name_en || it.slug),
      qty,
      unit_price_jod: unit,
      line_total_jod: Number((unit * qty).toFixed(2)),
      category_key: p.category_key ? String(p.category_key) : null,
    });
  }

  const subtotalBeforeDiscount = Number(lines.reduce((sum, l) => sum + l.line_total_jod, 0).toFixed(2));

  // (Promo support can be added later; keep it simple now)
  const discount = 0;
  const subtotalAfterDiscount = subtotalBeforeDiscount;
  const shippingJod = lines.length ? 3.5 : 0;
  const totalJod = Number((subtotalAfterDiscount + shippingJod).toFixed(2));

  const status =
    paymentMethod === "PAYTABS" ? "PENDING_PAYMENT" : "PENDING_COD_CONFIRM";

  const itemsJson = lines.map((l) => ({
    slug: l.slug,
    name_en: l.name_en,
    name_ar: l.name_ar,
    qty: l.qty,
    unit_price_jod: l.unit_price_jod,
    line_total_jod: l.line_total_jod,
  }));

  const r = await db.query<{ cart_id: string }>(
    `
    insert into orders (
      locale,
      status,
      amount,
      currency,
      payment_method,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      shipping_city,
      shipping_address,
      shipping_country,
      notes,
      items,
      subtotal_before_discount_jod,
      discount_jod,
      subtotal_after_discount_jod,
      shipping_jod,
      total_jod
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
      $14::jsonb,
      $15,$16,$17,$18,$19
    )
    returning cart_id
  `,
    [
      locale,
      status,
      totalJod,
      "JOD",
      paymentMethod,
      customerId ? Number(customerId) : null,
      name,
      phone,
      email,
      city || null,
      address,
      country,
      notes || null,
      JSON.stringify(itemsJson),
      subtotalBeforeDiscount,
      discount,
      subtotalAfterDiscount,
      shippingJod,
      totalJod,
    ]
  );

  const cartId = r.rows?.[0]?.cart_id;
  return NextResponse.json({ ok: true, cartId, status }, { status: 200 });
}
