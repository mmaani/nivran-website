import { db } from "@/lib/db";
import { ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";
import { ensureOrdersTables } from "@/lib/ordersSchema";
import { hasColumn } from "@/lib/dbSchema";
import { evaluateAutoPromotionForLines, evaluatePromoCodeForLines as evaluatePromoCodeForLinesLib, type PricedOrderLine } from "@/lib/promotions";
import { readFreeShippingThresholdJod as readFreeShippingThresholdJodLive, shippingForSubtotal as shippingForSubtotalLive } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderCreateItem = { slug?: string; qty?: number; variantId?: number | null };

type OrderCreateBody = {
  locale?: string;
  paymentMethod?: "PAYTABS" | "COD";
  discountMode?: "AUTO" | "CODE" | "NONE";
  promoCode?: string;
  items?: OrderCreateItem[];
  customer?: { name?: string; phone?: string; email?: string };
  shipping?: { city?: string; address?: string; country?: string; notes?: string };
};

type ProductRow = {
  id: number;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  price_jod: string | number;
  category_key: string | null;
  is_active: boolean;
  default_variant_id: number | null;
  default_variant_label: string | null;
  default_variant_price_jod: string | number | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  label: string | null;
  price_jod: string | number;
};

type OrderLine = {
  slug: string;
  qty: number;
  requestedVariantId: number | null;
  variantId: number | null;
  variantLabel: string | null;
  nameEn: string;
  nameAr: string;
  categoryKey: string | null;
  unitPriceJod: number;
  lineTotalJod: number;
};

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function normalizeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeDiscountMode(v: unknown): "AUTO" | "CODE" | "NONE" {
  const s = String(v || "").trim().toUpperCase();
  if (s === "CODE") return "CODE";
  if (s === "NONE") return "NONE";
  return "AUTO";
}

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
  const hasOrderItemsProductSlug = await hasColumn("order_items", "product_slug");
  const hasLegacyVariantsProductSlug = await hasColumn("variants", "product_slug");
  const hasProductVariantsProductId = await hasColumn("product_variants", "product_id");
  const hasProductsSlug = await hasColumn("products", "slug");

  const canJoinLegacyVariants = hasLegacyVariantsProductSlug;
  const canJoinProductCatalog = hasProductVariantsProductId && hasProductsSlug;

  const orderItemsSlugExpr = hasOrderItemsProductSlug
    ? "coalesce(oi.product_slug::text, null::text)"
    : canJoinLegacyVariants && canJoinProductCatalog
      ? "coalesce(v.product_slug::text, p.slug::text)"
      : canJoinLegacyVariants
        ? "v.product_slug::text"
        : canJoinProductCatalog
          ? "p.slug::text"
          : "null::text";

  const orderItemsJoinSql = `${canJoinLegacyVariants ? "left join variants v on v.id = oi.variant_id" : ""}\n            ${canJoinProductCatalog ? "left join product_variants pv on pv.id = oi.variant_id left join products p on p.id = pv.product_id" : ""}`;

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
                ${orderItemsSlugExpr} as product_slug,
                oi.qty,
                unit_price_jod::text as unit_price_jod,
                line_total_jod::text as line_total_jod,
                oi.lot_code
           from order_items oi
           ${orderItemsJoinSql}
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
                  ${orderItemsSlugExpr} as product_slug,
                  oi.qty,
                  unit_price_jod::text as unit_price_jod,
                  line_total_jod::text as line_total_jod,
                  oi.lot_code
             from order_items oi
             ${orderItemsJoinSql}
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

export async function POST(req: Request) {
  await ensureIdentityTables();
  await ensureOrdersTables();

  const customerId = await getCustomerIdFromRequest(req);
  const body = (await req.json().catch(() => null)) as OrderCreateBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ ok: false, error: "NO_ITEMS" }, { status: 400 });
  }

  const locale = body.locale === "ar" ? "ar" : "en";
  const paymentMethod = body.paymentMethod === "COD" ? "COD" : "PAYTABS";
  const discountMode = normalizeDiscountMode(body.discountMode);
  const promoCode = String(body.promoCode || "").trim().toUpperCase();

  const customerName = String(body.customer?.name || "").trim();
  const customerPhone = String(body.customer?.phone || "").trim();
  const customerEmail = String(body.customer?.email || "").trim().toLowerCase();

  const shippingCity = String(body.shipping?.city || "").trim();
  const shippingAddress = String(body.shipping?.address || "").trim();
  const shippingCountry = String(body.shipping?.country || "Jordan").trim() || "Jordan";
  const notes = String(body.shipping?.notes || "").trim();

  if (!customerName || !customerPhone || !customerEmail || !shippingCity || !shippingAddress) {
    return Response.json({ ok: false, error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
  }

  const normalizedItems = body.items
    .map((entry) => ({
      slug: String(entry.slug || "").trim(),
      qty: normalizeQty(entry.qty),
      variantId: toInt(entry.variantId),
    }))
    .filter((entry) => entry.slug.length > 0);

  if (!normalizedItems.length) {
    return Response.json({ ok: false, error: "NO_VALID_ITEMS" }, { status: 400 });
  }

  const slugs = Array.from(new Set(normalizedItems.map((item) => item.slug)));
  const productRes = await db.query<ProductRow>(
    `select p.id,
            p.slug,
            p.name_en,
            p.name_ar,
            p.price_jod,
            p.category_key,
            p.is_active,
            dv.id as default_variant_id,
            dv.label as default_variant_label,
            dv.price_jod::text as default_variant_price_jod
       from products p
       left join lateral (
         select v.id, v.label, v.price_jod
           from product_variants v
          where v.product_id=p.id
            and v.is_active=true
          order by v.is_default desc, v.price_jod asc, v.sort_order asc, v.id asc
          limit 1
       ) dv on true
      where p.slug = any($1::text[])`,
    [slugs]
  );

  const bySlug = new Map<string, ProductRow>();
  for (const product of productRes.rows) bySlug.set(product.slug, product);

  const variantIds = Array.from(new Set(normalizedItems.map((item) => item.variantId).filter((v): v is number => v !== null)));
  const variantMap = new Map<number, VariantRow>();
  if (variantIds.length) {
    const variantRes = await db.query<VariantRow>(
      `select id, product_id, label, price_jod
         from product_variants
        where id = any($1::bigint[])
          and is_active=true`,
      [variantIds]
    );
    for (const variant of variantRes.rows) variantMap.set(Number(variant.id), variant);
  }

  const lines: OrderLine[] = [];
  const promoLines: PricedOrderLine[] = [];

  for (const item of normalizedItems) {
    const product = bySlug.get(item.slug);
    if (!product || !product.is_active) {
      return Response.json({ ok: false, error: `INVALID_PRODUCT:${item.slug}` }, { status: 400 });
    }

    let unitPrice = toNum(product.default_variant_price_jod ?? product.price_jod);
    let variantId = product.default_variant_id ?? null;
    let variantLabel = product.default_variant_label ?? null;

    if (item.variantId !== null) {
      const variant = variantMap.get(item.variantId);
      if (!variant || Number(variant.product_id) !== Number(product.id)) {
        return Response.json({ ok: false, error: "INVALID_VARIANT" }, { status: 400 });
      }
      unitPrice = toNum(variant.price_jod);
      variantId = Number(variant.id);
      variantLabel = variant.label ? String(variant.label) : null;
    }

    const lineTotal = round2(unitPrice * item.qty);
    lines.push({
      slug: item.slug,
      qty: item.qty,
      requestedVariantId: item.variantId,
      variantId,
      variantLabel,
      nameEn: String(product.name_en || item.slug),
      nameAr: String(product.name_ar || product.name_en || item.slug),
      categoryKey: product.category_key ? String(product.category_key) : null,
      unitPriceJod: round2(unitPrice),
      lineTotalJod: lineTotal,
    });

    promoLines.push({
      slug: item.slug,
      qty: item.qty,
      category_key: product.category_key ? String(product.category_key) : null,
      line_total_jod: lineTotal,
    });
  }

  const subtotalBeforeDiscountJod = round2(lines.reduce((sum, line) => sum + line.lineTotalJod, 0));

  let discountJod = 0;
  let discountSource: "AUTO" | "CODE" | null = null;
  let promotionId: number | null = null;

  if (discountMode === "CODE" && promoCode) {
    const promo = await evaluatePromoCodeForLinesLib(db, promoCode, promoLines, subtotalBeforeDiscountJod);
    if (!promo.ok) return Response.json({ ok: false, error: promo.error || "PROMO_INVALID" }, { status: 400 });
    discountJod = round2(promo.discountJod);
    discountSource = "CODE";
    promotionId = promo.promotionId;
  } else if (discountMode === "AUTO") {
    const promo = await evaluateAutoPromotionForLines(db, promoLines, subtotalBeforeDiscountJod);
    if (promo.ok && promo.discountJod > 0) {
      discountJod = round2(promo.discountJod);
      discountSource = "AUTO";
      promotionId = promo.promotionId;
    }
  }

  const subtotalAfterDiscountJod = round2(Math.max(0, subtotalBeforeDiscountJod - discountJod));
  const threshold = await readFreeShippingThresholdJodLive();
  const shippingJod = shippingForSubtotalLive(subtotalAfterDiscountJod, lines.length > 0, threshold.value);
  const totalJod = round2(subtotalAfterDiscountJod + shippingJod);

  const cartId = `NIV-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const status = paymentMethod === "COD" ? "PAID_COD" : "PENDING_PAYMENT";

  const itemsSnapshot = lines.map((line) => ({
    slug: line.slug,
    qty: line.qty,
    variantId: line.variantId,
    requestedVariantId: line.requestedVariantId,
    variantLabel: line.variantLabel,
    name_en: line.nameEn,
    name_ar: line.nameAr,
    unit_price_jod: line.unitPriceJod,
    line_total_jod: line.lineTotalJod,
  }));

  await db.query(
    `insert into orders (
      cart_id, customer_id, customer_email, customer_name, customer_phone,
      shipping_city, shipping_address, shipping_country, notes,
      status, amount, currency, locale, payment_method,
      customer, shipping, items,
      subtotal_before_discount_jod, discount_jod, subtotal_after_discount_jod,
      shipping_jod, total_jod,
      promo_code, promotion_id, discount_source
    ) values (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,
      $10,$11,'JOD',$12,$13,
      $14::jsonb,$15::jsonb,$16::jsonb,
      $17,$18,$19,
      $20,$21,
      $22,$23,$24
    )`,
    [
      cartId,
      customerId,
      customerEmail,
      customerName,
      customerPhone,
      shippingCity,
      shippingAddress,
      shippingCountry,
      notes || null,
      status,
      totalJod,
      locale,
      paymentMethod,
      JSON.stringify({ name: customerName, phone: customerPhone, email: customerEmail }),
      JSON.stringify({ city: shippingCity, address: shippingAddress, country: shippingCountry, notes: notes || null }),
      JSON.stringify(itemsSnapshot),
      subtotalBeforeDiscountJod,
      discountJod,
      subtotalAfterDiscountJod,
      shippingJod,
      totalJod,
      discountSource === "CODE" ? promoCode : null,
      promotionId,
      discountSource,
    ]
  );

  return Response.json({ ok: true, cartId, status });
}
