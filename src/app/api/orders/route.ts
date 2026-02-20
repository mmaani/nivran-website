import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAllColumns, hasColumn } from "@/lib/dbSchema";
import { readFreeShippingThresholdJod, shippingForSubtotal } from "@/lib/shipping";
import { ensureOrdersTables } from "@/lib/orders";
import { ensureCatalogTables } from "@/lib/catalog";
import { getCustomerIdFromRequest } from "@/lib/identity";
import {
  consumePromotionUsage,
  evaluatePromoCodeForLines,
} from "@/lib/promotions";

type PaymentMethod = "PAYTABS" | "COD";

type IncomingItem = {
  slug?: string;
  qty?: number;
  variantId?: number | null;
};

type CustomerInput = { name?: string; phone?: string; email?: string };
type ShippingInput = { city?: string; address?: string; notes?: string; country?: string };

type ProductRow = {
  id: number;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  price_jod: string | number;
  category_key: string | null;
  is_active: boolean;
};

type VariantRow = {
  id: number;
  product_id: number;
  label: string;
  price_jod: string | number;
};

type OrderLine = {
  slug: string;
  variant_id: number | null;
  variant_label: string | null;
  name_en: string;
  name_ar: string;
  qty: number;
  unit_price_jod: number;
  line_total_jod: number;
  category_key: string | null;
};

function normalizeVariantId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}
function normalizeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}


async function fetchProductsBySlugs(slugs: string[]) {
  await ensureCatalogTables();
  const r = await db.query<ProductRow>(
    `select id, slug, name_en, name_ar, price_jod, category_key, is_active
       from products
      where slug = any($1::text[])`,
    [slugs]
  );
  return r.rows || [];
}

function normalizeItems(items: unknown): { slug: string; qty: number; variantId: number | null }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      variantId: normalizeVariantId(x?.variantId),
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

  const promoCode = String(body.promoCode || "").trim().toUpperCase();
  const discountMode = String(body.discountMode || "NONE").toUpperCase();
  const discountSource = discountMode === "CODE" ? "CODE" : null;

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
      {
        ok: false,
        error:
          locale === "ar"
            ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة"
            : "Missing required fields",
      },
      { status: 400 }
    );
  }

  let items = normalizeItems(body.items);

  const legacySlug = String(body.productSlug || body.slug || "").trim();
  const legacyQty = normalizeQty(body.qty);

  if (!items.length && legacySlug) {
    items = [{ slug: legacySlug, qty: legacyQty, variantId: null }];
  }

  if (!items.length) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "لا توجد عناصر في السلة." : "No items" },
      { status: 400 }
    );
  }

  if (discountSource === "CODE" && !promoCode) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "أدخل كود الخصم" : "Promo code is required" },
      { status: 400 }
    );
  }


  if (discountSource !== "CODE" && promoCode) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "لا يمكن استخدام الكود مع وضع الخصم الحالي" : "Promo code is only allowed with CODE mode" },
      { status: 400 }
    );
  }

  const slugs = Array.from(new Set(items.map((i) => i.slug)));
  const products = await fetchProductsBySlugs(slugs);

  const productBySlug = new Map<string, ProductRow>();
  for (const p of products) productBySlug.set(String(p.slug), p);

  // Fetch explicit variants (if variantId provided)
  const variantIds = Array.from(
    new Set(items.map((i) => i.variantId).filter((id): id is number => typeof id === "number"))
  );
  const variantMap = new Map<number, VariantRow>();
  if (variantIds.length) {
    const vr = await db.query<VariantRow>(
      `select id, product_id, label, price_jod
         from product_variants
        where id = any($1::bigint[])
          and is_active = true`,
      [variantIds]
    );
    for (const v of vr.rows || []) variantMap.set(v.id, v);
  }

  // Default ACTIVE variant fallback (used when variantId is omitted)
  // This prevents bypassing variant pricing by omitting variantId.
  const productIdsNeedingDefault: number[] = [];
  for (const it of items) {
    if (it.variantId != null) continue;
    const p = productBySlug.get(it.slug);
    if (p?.id) productIdsNeedingDefault.push(Number(p.id));
  }
  const uniqueProductIdsNeedingDefault = Array.from(new Set(productIdsNeedingDefault));

  const defaultVariantByProductId = new Map<number, VariantRow>();
  if (uniqueProductIdsNeedingDefault.length) {
    // Uses DISTINCT ON to pick one deterministic default ACTIVE variant per product.
    const dr = await db.query<VariantRow>(
      `
      select distinct on (product_id)
        id, product_id, label, price_jod
      from product_variants
      where product_id = any($1::bigint[])
        and is_active = true
      order by
        product_id,
        is_default desc,
        price_jod asc,
        sort_order asc,
        id asc
      `,
      [uniqueProductIdsNeedingDefault]
    );

    for (const v of dr.rows || []) defaultVariantByProductId.set(Number(v.product_id), v);
  }

  // 3) Build order lines (always apply variant pricing if default exists)
  const lines: OrderLine[] = [];

  for (const it of items) {
    const p = productBySlug.get(it.slug);
    if (!p || !p.is_active) {
      return NextResponse.json(
        { ok: false, error: `Unknown or inactive product: ${it.slug}` },
        { status: 400 }
      );
    }

    let unit = Number(p.price_jod || 0);
    let chosenVariantId: number | null = null;
    let variantLabel: string | null = null;

    if (it.variantId != null) {
      const variant = variantMap.get(it.variantId);
      if (!variant || Number(variant.product_id) !== Number(p.id)) {
        return NextResponse.json(
          { ok: false, error: `Invalid variant for product: ${it.slug}` },
          { status: 400 }
        );
      }
      unit = Number(variant.price_jod || 0);
      chosenVariantId = variant.id;
      variantLabel = String(variant.label || "");
    } else {
      const def = defaultVariantByProductId.get(Number(p.id));
      if (def) {
        unit = Number(def.price_jod || 0);
        chosenVariantId = def.id;
        variantLabel = String(def.label || "");
      }
      // else: keep product base price as final fallback
    }

    const qty = it.qty;

    lines.push({
      slug: it.slug,
      variant_id: chosenVariantId,
      variant_label: variantLabel,
      name_en: String(p.name_en || it.slug),
      name_ar: String(p.name_ar || p.name_en || it.slug),
      qty,
      unit_price_jod: unit,
      line_total_jod: Number((unit * qty).toFixed(2)),
      category_key: p.category_key ? String(p.category_key) : null,
    });
  }

  const subtotalBeforeDiscount = Number(lines.reduce((sum, l) => sum + l.line_total_jod, 0).toFixed(2));

  let discount = 0;
  let subtotalAfterDiscount = subtotalBeforeDiscount;
  let promotionId: number | null = null;
  let finalPromoCode: string | null = null;

  if (discountSource === "CODE") {
    const codeEval = await evaluatePromoCodeForLines(db, promoCode, lines, subtotalBeforeDiscount);
    if (!codeEval.ok) {
      return NextResponse.json(
        { ok: false, error: locale === "ar" ? "كود الخصم غير صالح أو غير متاح" : "Promo code is invalid or not eligible" },
        { status: 400 }
      );
    }
    discount = codeEval.discountJod;
    subtotalAfterDiscount = codeEval.subtotalAfterDiscountJod;
    promotionId = codeEval.promotionId;
    finalPromoCode = codeEval.promoCode || promoCode;
  }

  const shippingThreshold = await readFreeShippingThresholdJod();
  const freeShippingThresholdJod = shippingThreshold.value;
  const shippingJod = shippingForSubtotal(subtotalAfterDiscount, lines.length > 0, freeShippingThresholdJod);
  const totalJod = Number((subtotalAfterDiscount + shippingJod).toFixed(2));

  const status = paymentMethod === "PAYTABS" ? "PENDING_PAYMENT" : "PENDING_COD_CONFIRM";

  const itemsJson = lines.map((l) => ({
    slug: l.slug,
    variant_id: l.variant_id,
    variant_label: l.variant_label,
    name_en: l.name_en,
    name_ar: l.name_ar,
    qty: l.qty,
    unit_price_jod: l.unit_price_jod,
    line_total_jod: l.line_total_jod,
    category_key: l.category_key,
  }));

  const generatedCartId = `NIV-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const hasExtendedOrderColumns = await hasAllColumns("orders", [
    "customer_phone",
    "shipping_city",
    "shipping_address",
    "shipping_country",
    "notes",
    "items",
    "subtotal_before_discount_jod",
    "discount_jod",
    "subtotal_after_discount_jod",
    "shipping_jod",
    "total_jod",
    "promo_code",
    "promotion_id",
    "discount_source",
  ]);
  const hasCustomerId = await hasColumn("orders", "customer_id");

  const insertedCartId = await db
    .withTransaction(async (trx) => {
      if (promotionId) {
        const consumed = await consumePromotionUsage(trx, promotionId);
        if (!consumed) {
          throw new Error(locale === "ar" ? "كود الخصم تجاوز حد الاستخدام" : "Promo code usage limit reached");
        }
      }

      const r = hasExtendedOrderColumns
        ? await trx.query<{ cart_id: string }>(
            `
            insert into orders (
              cart_id,
              locale,
              status,
              amount,
              currency,
              payment_method,
              ${hasCustomerId ? "customer_id," : ""}
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
              total_jod,
              promo_code,
              promotion_id,
              discount_source
            )
            values (
              $1,$2,$3,$4,$5,$6,
              ${hasCustomerId ? "$7," : ""}
              $8,$9,$10,$11,$12,$13,$14,
              $15::jsonb,
              $16,$17,$18,$19,$20,$21,$22,$23
            )
            returning cart_id
          `,
            [
              generatedCartId,
              locale,
              status,
              totalJod,
              "JOD",
              paymentMethod,
              ...(hasCustomerId ? [customerId ? Number(customerId) : null] : []),
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
              finalPromoCode,
              promotionId,
              discountSource,
            ]
          )
        : await trx.query<{ cart_id: string }>(
            `
            insert into orders (
              cart_id,
              locale,
              status,
              amount,
              currency,
              payment_method,
              ${hasCustomerId ? "customer_id," : ""}
              customer_name,
              customer_email,
              customer,
              shipping
            )
            values (
              $1,$2,$3,$4,$5,$6,
              ${hasCustomerId ? "$7," : ""}
              $8,$9,$10::jsonb,$11::jsonb
            )
            returning cart_id
          `,
            [
              generatedCartId,
              locale,
              status,
              totalJod,
              "JOD",
              paymentMethod,
              ...(hasCustomerId ? [customerId ? Number(customerId) : null] : []),
              name,
              email,
              JSON.stringify({ name, phone, email, promoCode: finalPromoCode, discountSource }),
              JSON.stringify({ city, address, country, notes, items: itemsJson }),
            ]
          );

      return r.rows?.[0]?.cart_id || generatedCartId;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Order create failed";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    });

  if (insertedCartId instanceof NextResponse) return insertedCartId;

  return NextResponse.json(
    {
      ok: true,
      cartId: insertedCartId,
      status,
      totals: {
        subtotalBeforeDiscount,
        discountJod: discount,
        subtotalAfterDiscount,
        shippingJod,
        freeShippingThresholdJod,
        totalJod,
      },
      discount: {
        source: discountSource,
        code: finalPromoCode,
        applied: discount > 0,
        discountJod: discount,
      },
    },
    { status: 200 }
  );
}
