import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe, isRecoverableCatalogSetupError } from "@/lib/catalog";
import { readFreeShippingThresholdJod, shippingForSubtotal } from "@/lib/shipping";
import {
  evaluateAutoPromotionForLines,
  evaluatePromoCodeForLines,
  type PricedOrderLine,
  type PromotionEvaluation,
} from "@/lib/promotions";

type DiscountMode = "AUTO" | "CODE" | "NONE";

type IncomingItem = {
  slug?: string;
  qty?: number;
  variantId?: number | null;
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

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}

function normalizeVariantId(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function normalizeDiscountMode(v: unknown): DiscountMode {
  const s = String(v || "").trim().toUpperCase();
  if (s === "CODE") return "CODE";
  if (s === "NONE") return "NONE";
  return "AUTO";
}

function normalizeItems(items: unknown): Array<{ slug: string; qty: number; variantId: number | null }>
{
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
      qty: normalizeQty(x?.qty),
      variantId: normalizeVariantId(x?.variantId),
    }))
    .filter((x) => x.slug.length > 0);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const bootstrap = await ensureCatalogTablesSafe();
  if (!bootstrap.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Catalog temporarily unavailable",
        reason: "CATALOG_BOOTSTRAP_UNAVAILABLE",
        details: { catalogBootstrapReason: bootstrap.reason || null },
      },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } }
    );
  }

  try {
    const raw = (await req.json().catch(() => null)) as unknown;
    const body: JsonRecord = isRecord(raw) ? raw : {};

    const locale = body.locale === "ar" ? "ar" : "en";
    const discountMode = normalizeDiscountMode(body.discountMode ?? body.mode);
    const promoCode = String(body.promoCode || "").trim().toUpperCase();

    const items = normalizeItems(body.items);
    if (!items.length) {
      return NextResponse.json(
        { ok: true, quote: { lines: [], totals: { subtotalBeforeDiscountJod: 0, discountJod: 0, subtotalAfterDiscountJod: 0, shippingJod: 0, totalJod: 0, freeShippingThresholdJod: 0 }, discount: { source: null, code: null, promotionId: null } } },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }

    if (discountMode === "CODE" && !promoCode) {
      return NextResponse.json(
        { ok: false, error: locale === "ar" ? "أدخل كود الخصم" : "Promo code is required", reason: "PROMO_INVALID" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const slugs = Array.from(new Set(items.map((i) => i.slug)));

    // Fetch products + deterministic default ACTIVE variant
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

    const productBySlug = new Map<string, ProductRow>();
    for (const p of productRes.rows || []) productBySlug.set(String(p.slug), p);

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
            and is_active=true`,
        [variantIds]
      );
      for (const v of vr.rows || []) variantMap.set(Number(v.id), v);
    }

    // Build priced lines
    const pricedLines: Array<{
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
    }> = [];

    const promoLines: PricedOrderLine[] = [];

    for (const it of items) {
      const p = productBySlug.get(it.slug);
      if (!p || !p.is_active) {
        return NextResponse.json(
          { ok: false, error: locale === "ar" ? "يوجد منتج غير صالح في السلة" : `Invalid product: ${it.slug}`, reason: "INVALID_PRODUCT" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }

      let unit = toNum(p.default_variant_price_jod ?? p.price_jod);
      let chosenVariantId: number | null = p.default_variant_id ?? null;
      let chosenVariantLabel: string | null = p.default_variant_label ?? null;

      if (it.variantId != null) {
        const v = variantMap.get(it.variantId);
        if (!v || Number(v.product_id) !== Number(p.id)) {
          return NextResponse.json(
            { ok: false, error: locale === "ar" ? "النسخة المختارة غير صالحة" : "Selected variant is invalid", reason: "INVALID_VARIANT" },
            { status: 400, headers: { "cache-control": "no-store" } }
          );
        }
        unit = toNum(v.price_jod);
        chosenVariantId = Number(v.id);
        chosenVariantLabel = v.label ? String(v.label) : null;
      }

      const lineTotal = Number((unit * it.qty).toFixed(2));

      pricedLines.push({
        slug: it.slug,
        qty: it.qty,
        requestedVariantId: it.variantId,
        variantId: chosenVariantId,
        variantLabel: chosenVariantLabel,
        nameEn: String(p.name_en || it.slug),
        nameAr: String(p.name_ar || p.name_en || it.slug),
        categoryKey: p.category_key ? String(p.category_key) : null,
        unitPriceJod: Number(unit.toFixed(2)),
        lineTotalJod: lineTotal,
      });

      promoLines.push({
        slug: it.slug,
        qty: it.qty,
        category_key: p.category_key ? String(p.category_key) : null,
        line_total_jod: lineTotal,
      });
    }

    const subtotalBeforeDiscountJod = Number(
      pricedLines.reduce((sum, l) => sum + toNum(l.lineTotalJod), 0).toFixed(2)
    );

    let promoEval: PromotionEvaluation | null = null;
    let discountSource: "AUTO" | "CODE" | null = null;

    if (discountMode === "CODE") {
      const codeEval = await evaluatePromoCodeForLines(db, promoCode, promoLines, subtotalBeforeDiscountJod);
      if (!codeEval.ok) {
        const shippingThreshold = await readFreeShippingThresholdJod().catch(() => ({ value: 50, fallback: true }));
        const freeShippingThresholdJod = Number(shippingThreshold.value || 0);
        const shippingJod = shippingForSubtotal(subtotalBeforeDiscountJod, pricedLines.length > 0, freeShippingThresholdJod);
        const totalJod = Number((subtotalBeforeDiscountJod + shippingJod).toFixed(2));

        return NextResponse.json(
          {
            ok: false,
            error: locale === "ar" ? "الخصم غير صالح أو غير متاح" : "Discount is invalid or not eligible",
            reason: codeEval.code,
            quote: {
              lines: pricedLines,
              totals: {
                subtotalBeforeDiscountJod,
                discountJod: 0,
                subtotalAfterDiscountJod: subtotalBeforeDiscountJod,
                shippingJod,
                totalJod,
                freeShippingThresholdJod,
              },
              discount: { source: null, code: null, promotionId: null },
            },
          },
          { status: 200, headers: { "cache-control": "no-store" } }
        );
      }

      promoEval = codeEval;
      discountSource = "CODE";
    } else if (discountMode === "AUTO") {
      const autoEval = await evaluateAutoPromotionForLines(db, promoLines, subtotalBeforeDiscountJod);
      if (autoEval.ok && autoEval.discountJod > 0) {
        promoEval = autoEval;
        discountSource = "AUTO";
      }
    }

    const discountJod = promoEval && promoEval.ok ? promoEval.discountJod : 0;
    const subtotalAfterDiscountJod = Number(Math.max(0, subtotalBeforeDiscountJod - discountJod).toFixed(2));

    const shippingThreshold = await readFreeShippingThresholdJod().catch(() => ({ value: 50, fallback: true }));
    const freeShippingThresholdJod = Number(shippingThreshold.value || 0);
    const shippingJod = shippingForSubtotal(subtotalAfterDiscountJod, pricedLines.length > 0, freeShippingThresholdJod);
    const totalJod = Number((subtotalAfterDiscountJod + shippingJod).toFixed(2));

    return NextResponse.json(
      {
        ok: true,
        quote: {
          lines: pricedLines,
          totals: {
            subtotalBeforeDiscountJod,
            discountJod,
            subtotalAfterDiscountJod,
            shippingJod,
            totalJod,
            freeShippingThresholdJod,
          },
          discount:
            promoEval && promoEval.ok
              ? {
                  source: discountSource,
                  code: promoEval.promoCode,
                  promotionId: promoEval.promotionId,
                  titleEn: promoEval.meta.titleEn,
                  titleAr: promoEval.meta.titleAr,
                  discountType: promoEval.meta.discountType,
                  discountValue: promoEval.meta.discountValue,
                  eligibleSubtotalJod: promoEval.eligibleSubtotalJod,
                }
              : { source: null, code: null, promotionId: null },
        },
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (error: unknown) {
    if (isDbConnectivityError(error) || isRecoverableCatalogSetupError(error)) {
      return NextResponse.json(
        { ok: false, error: "Pricing quote temporarily unavailable", reason: "DB_CONNECTIVITY" },
        { status: 503, headers: { "retry-after": "30", "cache-control": "no-store" } }
      );
    }
    throw error;
  }
}
