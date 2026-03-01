import { NextResponse } from "next/server";
import crypto from "crypto";
import { db, type DbExecutor } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";
import {
  evaluateAutoPromotionForLines,
  evaluatePromoCodeForLines,
  type PricedOrderLine,
} from "@/lib/promotions";
import { hashPassword } from "@/lib/identity";
import { sendOrderThankYouEmail, sendSalesWelcomeEmail } from "@/lib/email";

type CheckoutItem = {
  productId: number;
  qty: number;
  variantId?: number | null;
  productSlug?: string | null;
};

type PromoEval =
  | { ok: true; discountJod: number; promotionId: number }
  | { ok: false; error?: string };

type CheckoutBody = {
  items: CheckoutItem[];
  promoCode?: string;
  applyPromotion?: boolean;
  paymentMethod?: "CARD_ONLINE" | "CARD_POS" | "CASH";
  customer: { name: string; email: string; phone: string; city: string; address: string; country?: string };
  createAccount?: boolean;
  accountPassword?: string;
};

export const runtime = "nodejs";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseVariantId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeQty(value: unknown): number {
  const parsed = Math.trunc(Number(value || 0));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 999) : 1;
}

type PaymentMethod = "CARD_ONLINE" | "CARD_POS" | "CASH";
function normalizePaymentMethod(v: unknown): PaymentMethod {
  const s = String(v || "").toUpperCase();
  if (s === "CARD_ONLINE") return "CARD_ONLINE";
  if (s === "CARD_POS") return "CARD_POS";
  if (s === "CASH") return "CASH";
  return "CARD_POS";
}

function promoError(p: PromoEval): string | null {
  if (p.ok) return null;
  const msg = typeof p.error === "string" ? p.error.trim() : "";
  return msg ? msg : null;
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

  const customerName = String(body.customer?.name || "").trim();
  const customerPhone = String(body.customer?.phone || "").trim();
  const customerCity = String(body.customer?.city || "").trim();
  const customerAddress = String(body.customer?.address || "").trim();
  const customerCountry = String(body.customer?.country || "Jordan").trim() || "Jordan";

  const paymentMethod = normalizePaymentMethod(body.paymentMethod);

  const productIds = Array.from(
    new Set(body.items.map((line) => Number(line.productId)).filter((n) => Number.isFinite(n) && n > 0))
  );

  const productSlugs = Array.from(
    new Set(
      body.items
        .map((line) => String(line.productSlug || "").trim().toLowerCase())
        .filter((slug) => slug.length > 0)
    )
  );

  const variantIds = Array.from(
    new Set(
      body.items
        .map((line) => parseVariantId(line.variantId))
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    )
  );

  const response = await db.withTransaction(async (trx) => {
    const productsRes = await trx.query<{
      id: number;
      slug: string;
      name_en: string;
      name_ar: string | null;
      category_key: string | null;
      price_jod: string;
      inventory_qty: number;
    }>(
      `
       select id::int as id, slug, name_en, name_ar, category_key, price_jod::text, inventory_qty::int as inventory_qty
         from products
        where id = any($1::bigint[])
        for update`,
      [productIds]
    );

const fallbackBySlugRes = productSlugs.length
  ? await trx.query<{
      id: number;
      slug: string;
      name_en: string;
      name_ar: string | null;
      category_key: string | null;
      price_jod: string;
      inventory_qty: number;
    }>(
      `select id::int as id,
              slug,
              name_en,
              name_ar,
              category_key,
              price_jod::text,
              inventory_qty::int as inventory_qty
         from products
        where lower(slug) = any($1::text[])`,
      [productSlugs]
    )
  : {
      rows: [] as Array<{
        id: number;
        slug: string;
        name_en: string;
        name_ar: string | null;
        category_key: string | null;
        price_jod: string;
        inventory_qty: number;
      }>,
    };

const variantRes = variantIds.length
  ? await trx.query<{
      id: number;
      product_id: number;
      label: string;
      size_ml: number | null;
      price_jod: string;
      is_active: boolean;
    }>(
      `select id::int as id,
              product_id::int as product_id,
              label,
              size_ml,
              price_jod::text,
              is_active
         from product_variants
        where id = any($1::bigint[])
        for update`,
      [variantIds]
    )
  : {
      rows: [] as Array<{
        id: number;
        product_id: number;
        label: string;
        size_ml: number | null;
        price_jod: string;
        is_active: boolean;
      }>,
    };

    const allProductRows = [...productsRes.rows, ...fallbackBySlugRes.rows];

    const productMap = new Map(allProductRows.map((row) => [row.id, row]));
    const productSlugMap = new Map(allProductRows.map((row) => [String(row.slug || "").toLowerCase(), row]));
    const variantMap = new Map(variantRes.rows.map((row) => [row.id, row]));

    const aggregated = body.items.reduce((m, item) => {
      const productId = Math.trunc(Number(item.productId || 0));
      const variantId = parseVariantId(item.variantId);
      const key = Number.isFinite(productId) && productId > 0 ? `${productId}:${variantId ?? "base"}` : "";
      if (!key) return m;

      const prev = m.get(key);
      const nextQty = normalizeQty(item.qty) + (prev?.qty || 0);

      m.set(key, {
        productId,
        variantId,
        qty: Math.min(nextQty, 999),
        productSlug: String(item.productSlug || "").trim().toLowerCase() || null,
      });

      return m;
    }, new Map<string, { productId: number; variantId: number | null; qty: number; productSlug: string | null }>());

    const built = Array.from(aggregated.values()).reduce(
      (acc, item) => {
        const qty = normalizeQty(item.qty);

        const directProduct = acc.productMap.get(item.productId) || null;
        const directVariant = item.variantId ? acc.variantMap.get(item.variantId) || null : null;

        const inferredVariant = !directProduct ? acc.variantMap.get(item.productId) || null : null;
        const inferredProductId = inferredVariant ? inferredVariant.product_id : item.productId;

        const productFromInferred =
          !directProduct && inferredVariant ? acc.productMap.get(inferredProductId) || null : directProduct;

        const productFromVariant =
          !productFromInferred && directVariant ? acc.productMap.get(directVariant.product_id) || null : productFromInferred;

        const productFromSlug =
          !productFromVariant && item.productSlug ? acc.productSlugMap.get(item.productSlug) || null : productFromVariant;

        const finalProduct = productFromSlug;
        const finalVariant =
          directVariant && finalProduct && directVariant.product_id === finalProduct.id ? directVariant : inferredVariant;

        const invalidVariant =
          !!finalVariant && !!finalProduct && (!finalVariant.is_active || finalVariant.product_id !== finalProduct.id);

        if (invalidVariant) {
          return {
            ...acc,
            hardError: {
              ok: false as const,
              status: 400,
              error: `Invalid variant selection for product ${finalProduct?.id ?? "unknown"}`,
              missingProductIds: [] as number[],
              staleCart: false,
            },
          };
        }

        if (!finalProduct) {
          return {
            ...acc,
            missingProductIds:
              item.productId > 0 ? new Set([...acc.missingProductIds, item.productId]) : acc.missingProductIds,
          };
        }

        const unit = finalVariant ? Number(finalVariant.price_jod) : Number(finalProduct.price_jod);
        const lineTotal = round2(unit * qty);
        const available = Math.max(0, Math.trunc(Number(finalProduct.inventory_qty || 0)));
        const fulfilledQty = Math.min(available, qty);
        const backorderQty = qty - fulfilledQty;

        const variantLabel = finalVariant
          ? `${finalVariant.label}${finalVariant.size_ml ? ` (${finalVariant.size_ml}ml)` : ""}`
          : null;

        const nextLine = {
          product_id: finalProduct.id,
          variant_id: finalVariant?.id || null,
          variant_label: variantLabel,
          name_en: finalProduct.name_en,
          name_ar: finalProduct.name_ar || null,
          qty,
          requested_qty: qty,
          fulfilled_qty: fulfilledQty,
          backorder_qty: backorderQty,
          slug: finalProduct.slug,
          category_key: finalProduct.category_key,
          unit_price_jod: unit,
          line_total_jod: lineTotal,
        };

        return {
          ...acc,
          lines: [...acc.lines, nextLine],
        };
      },
      {
        productMap,
        productSlugMap,
        variantMap,
        lines: [] as Array<
          PricedOrderLine & {
            product_id: number;
            variant_id: number | null;
            variant_label: string | null;
            name_en: string;
            name_ar: string | null;
            unit_price_jod: number;
            requested_qty: number;
            fulfilled_qty: number;
            backorder_qty: number;
          }
        >,
        missingProductIds: new Set<number>(),
        hardError: null as
          | null
          | { ok: false; status: number; error: string; missingProductIds: number[]; staleCart: boolean },
      }
    );

    if (built.hardError) return built.hardError;

    if (built.lines.length === 0) {
      const missing = Array.from(built.missingProductIds).join(", ") || "unknown";
      return {
        ok: false as const,
        status: 409,
        error: `No valid items found for checkout. Missing products: ${missing}. Please refresh catalog and retry.`,
        missingProductIds: Array.from(built.missingProductIds),
        staleCart: true,
      };
    }

    const subtotal = round2(built.lines.reduce((sum, line) => sum + line.line_total_jod, 0));
    const applyPromotion = body.applyPromotion === true;
    const promoCode = applyPromotion ? String(body.promoCode || "").trim().toUpperCase() : "";

    const promoEval: PromoEval = applyPromotion
      ? promoCode
        ? ((await evaluatePromoCodeForLines(trx as unknown as DbExecutor, promoCode, built.lines, subtotal)) as PromoEval)
        : ((await evaluateAutoPromotionForLines(trx as unknown as DbExecutor, built.lines, subtotal)) as PromoEval)
      : { ok: false };

    const promoCodeError = applyPromotion && promoCode ? promoError(promoEval) : null;
    if (promoCodeError) {
      return {
        ok: false as const,
        status: 400,
        error: promoCodeError,
        missingProductIds: [] as number[],
        staleCart: false,
      };
    }

    const discountJod = promoEval.ok ? round2(promoEval.discountJod) : 0;
    const promotionId = promoEval.ok ? promoEval.promotionId : null;

    const existingCustomer = await trx
      .query<{ id: number }>(`select id from customers where lower(email)=lower($1) limit 1`, [customerEmail])
      .catch(() => ({ rows: [] as Array<{ id: number }> }));

    const matchedCustomerId = existingCustomer.rows[0]?.id ? Number(existingCustomer.rows[0].id) : null;

    const createdCustomer =
      !matchedCustomerId && body.createAccount
        ? await (async () => {
            const password = String(body.accountPassword || "").trim();
            if (!password) {
              return {
                ok: false as const,
                status: 400,
                error: "Account password required",
                missingProductIds: [] as number[],
                staleCart: false,
              };
            }
            const passwordHash = await hashPassword(password);
            const created = await trx.query<{ id: number }>(
              `insert into customers (email, password_hash, full_name, phone, address_line1, city, country, is_active)
               values ($1,$2,$3,$4,$5,$6,$7,true)
               returning id`,
              [
                customerEmail,
                passwordHash,
                customerName || null,
                customerPhone || null,
                customerAddress || null,
                customerCity || null,
                customerCountry,
              ]
            );
            const createdId = created.rows[0]?.id ? Number(created.rows[0].id) : null;

            return createdId ? { ok: true as const, id: createdId, password } : { ok: false as const, status: 500, error: "Failed to create customer" };
          })()
        : null;

    if (createdCustomer && "ok" in createdCustomer && createdCustomer.ok === false) {
      return {
        ok: false as const,
        status: createdCustomer.status,
        error: createdCustomer.error,
        missingProductIds: [] as number[],
        staleCart: false,
      };
    }

    const customerId =
      matchedCustomerId || (createdCustomer && "ok" in createdCustomer && createdCustomer.ok ? createdCustomer.id : null);

    if (matchedCustomerId) {
      await trx.query(
        `update customers
            set full_name = coalesce(nullif($1,''), full_name),
                phone = coalesce(nullif($2,''), phone),
                address_line1 = coalesce(nullif($3,''), address_line1),
                city = coalesce(nullif($4,''), city),
                country = coalesce(nullif($5,''), country)
          where id = $6`,
        [customerName, customerPhone, customerAddress, customerCity, customerCountry, matchedCustomerId]
      );
    }

    const hasBackorder = built.lines.some((line) => line.backorder_qty > 0);
    const isOnlineCard = paymentMethod === "CARD_ONLINE";

    // ✅ FIX: Online card starts PENDING_PAYMENT (PayTabs later decides PAID/FAILED)
    const status = hasBackorder ? "BACKORDER" : isOnlineCard ? "PENDING_PAYMENT" : "PAID";

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
        $1,$2,$3,'JOD','en',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,now(),now(),$22
      ) returning id`,
      [
        cartId,
        status,
        total,
        paymentMethod,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        customerCity,
        customerAddress,
        customerCountry,
        subtotal,
        discountJod,
        round2(subtotal - discountJod),
        shippingJod,
        total,
        applyPromotion && promoCode ? promoCode : null,
        promotionId,
        applyPromotion && promoCode && discountJod > 0 ? "CODE" : null,
        JSON.stringify(
          built.lines.map((line) => ({
            productId: line.product_id,
            resolvedProductId: line.product_id,
            variantId: line.variant_id,
            variantLabel: line.variant_label,
            requested_qty: line.requested_qty,
            fulfilled_qty: line.fulfilled_qty,
            backorder_qty: line.backorder_qty,
            slug: line.slug,
            unit_price_jod: line.unit_price_jod,
            line_total_jod: line.line_total_jod,
          }))
        ),
        hasBackorder ? "Contains backordered quantities" : null,
        // ✅ only set committed_at when we truly commit immediately
        status === "PAID" ? new Date() : null,
      ]
    );

    const orderId = inserted.rows[0]?.id;
    if (!orderId) {
      return {
        ok: false as const,
        status: 500,
        error: "Failed to create order",
        missingProductIds: [] as number[],
        staleCart: false,
      };
    }

    // ✅ Only decrement inventory if we set status=PAID here.
    // Online card (PENDING_PAYMENT) is committed later by PayTabs callback flow.
    if (status === "PAID") {
      await Promise.all(
        built.lines
          .filter((line) => line.fulfilled_qty > 0)
          .map((line) =>
            trx.query(
              `update products
                  set inventory_qty = greatest(0, inventory_qty - $1),
                      updated_at=now()
                where id=$2`,
              [line.fulfilled_qty, line.product_id]
            )
          )
      );
    }

    await trx.query(
      `insert into sales_audit_logs (order_id, actor_role, actor_staff_id, actor_username, action, payload)
       values ($1,$2,$3,$4,'CREATE_SALE',$5::jsonb)`,
      [
        orderId,
        auth.role,
        auth.staffId,
        auth.username,
        JSON.stringify({
          total_jod: total,
          subtotal_jod: subtotal,
          discount_jod: discountJod,
          item_count: built.lines.length,
          has_backorder: hasBackorder,
          payment_method: paymentMethod,
        }),
      ]
    );

    return {
      ok: true as const,
      status: 200,
      orderId,
      cartId,
      totalJod: total,
      statusCode: status,
      ignoredProductIds: Array.from(built.missingProductIds),
      missingProductIds: Array.from(built.missingProductIds),
      customerMatched: !!matchedCustomerId,
      customerCreated: !!(createdCustomer && "ok" in createdCustomer && createdCustomer.ok),
      createdAccountPassword: createdCustomer && "ok" in createdCustomer && createdCustomer.ok ? createdCustomer.password : null,
      createdAccountEmail: customerEmail || null,
      createdAccountName: customerName || null,
      welcomeOrderItems: built.lines.map((line) => ({
        nameEn: line.name_en,
        nameAr: line.name_ar,
        qty: line.requested_qty,
        totalJod: line.line_total_jod,
      })),
      warning:
        built.missingProductIds.size > 0
          ? `Some products were unavailable and skipped: ${Array.from(built.missingProductIds).join(", ")}`
          : hasBackorder
          ? "Some quantities were backordered due to inventory limits"
          : null,
    };
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: response.error,
        missingProductIds: response.missingProductIds,
        staleCart: response.staleCart,
      },
      { status: response.status }
    );
  }

  // Account created email (fine regardless of payment status)
  if (response.customerCreated && response.createdAccountEmail && response.createdAccountPassword) {
    await sendSalesWelcomeEmail({
      to: String(response.createdAccountEmail),
      customerName: String(response.createdAccountName || body.customer?.name || "Customer"),
      temporaryPassword: String(response.createdAccountPassword),
      items: Array.isArray(response.welcomeOrderItems) ? response.welcomeOrderItems : [],
      totalJod: Number(response.totalJod || 0),
      accountUrl: "https://www.nivran.com/en/account",
    }).catch(() => null);
  }

  // ✅ Only send thank-you here if we truly marked PAID in this route (CASH / CARD_POS).
  // Online card (PENDING_PAYMENT) will be emailed by PayTabs callback after PAID.
  if (response.statusCode === "PAID" && response.createdAccountEmail) {
    await sendOrderThankYouEmail({
      to: String(response.createdAccountEmail),
      customerName: String(response.createdAccountName || body.customer?.name || "Customer"),
      items: Array.isArray(response.welcomeOrderItems) ? response.welcomeOrderItems : [],
      totalJod: Number(response.totalJod || 0),
      accountUrl: "https://www.nivran.com/en/account",
      returningCustomer: response.customerMatched === true,
      cartId: String(response.cartId || ""),
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    orderId: response.orderId,
    cartId: response.cartId,
    totalJod: response.totalJod,
    statusCode: response.statusCode,
    ignoredProductIds: response.ignoredProductIds,
    missingProductIds: response.missingProductIds,
    customerMatched: response.customerMatched,
    customerCreated: response.customerCreated,
    createdAccountEmail: response.createdAccountEmail,
    warning: response.warning,
  });
}