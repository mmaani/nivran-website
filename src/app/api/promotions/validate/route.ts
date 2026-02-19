import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import {
  evaluatePromoCodeForLines,
  type PricedOrderLine,
} from "@/lib/promotions";

type PromoMode = "CODE" | "AUTO";
type IncomingItem = { slug?: string; qty?: number; variantId?: number | null };
type ProductRow = {
  id: number;
  slug: string;
  category_key: string | null;
  is_active: boolean;
  unit_price_jod: string | number;
};
type VariantRow = { id: number; product_id: number; price_jod: string | number };

function normalizeQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}

function normalizeVariantId(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function normalizeItems(items: unknown): { slug: string; qty: number; variantId: number | null }[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
      qty: normalizeQty(x?.qty),
      variantId: normalizeVariantId(x?.variantId),
    }))
    .filter((x) => x.slug.length > 0);
}

function pickMode(value: unknown): PromoMode {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "AUTO" ? "AUTO" : "CODE";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const bootstrap = await ensureCatalogTablesSafe();
  if (!bootstrap.ok) {
    return NextResponse.json(
      { ok: false, error: "Catalog is currently unavailable", reason: "CATALOG_BOOTSTRAP_UNAVAILABLE" },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

    const locale = body.locale === "ar" ? "ar" : "en";
    const mode = String(body.mode || "CODE").toUpperCase();
    const promoCode = String(body.promoCode || "").trim().toUpperCase();
    const normalized = normalizeItems(body.items);

    if (mode === "AUTO" && promoCode) {
      return NextResponse.json(
        {
          ok: false,
          error: locale === "ar" ? "لا يمكن استخدام الكود مع وضع AUTO" : "Promo code is not allowed in AUTO mode",
          reason: "DISCOUNT_MODE_UNSUPPORTED",
        },
        { status: 400 }
      );
    }

    if (mode !== "CODE") {
      return NextResponse.json(
        {
          ok: false,
          error: locale === "ar" ? "وضع الخصم غير مدعوم" : "Unsupported discount mode",
          reason: "DISCOUNT_MODE_UNSUPPORTED",
        },
        { status: 400 }
      );
    }

    if (!normalized.length) {
      return NextResponse.json({ ok: false, error: locale === "ar" ? "السلة فارغة" : "Cart items are required" }, { status: 400 });
    }

    if (mode === "CODE" && !promoCode) {
      return NextResponse.json({ ok: false, error: locale === "ar" ? "أدخل كود الخصم" : "Promo code is required" }, { status: 400 });
    }

    const slugs = Array.from(new Set(normalized.map((i) => i.slug)));
    const productRes = await db.query<ProductRow>(
      `select p.id,
              p.slug,
              p.category_key,
              p.is_active,
              coalesce(v.price_jod, p.price_jod)::text as unit_price_jod
         from products p
         left join lateral (
           select pv.price_jod
             from product_variants pv
            where pv.product_id=p.id
              and pv.is_active=true
            order by pv.is_default desc, pv.price_jod asc, pv.sort_order asc, pv.id asc
            limit 1
         ) v on true
        where p.slug = any($1::text[])`,
      [slugs]
    );
    const productMap = new Map(productRes.rows.map((p) => [p.slug, p]));

    const variantIds = Array.from(new Set(normalized.map((i) => i.variantId).filter((id): id is number => typeof id === "number")));
    const variantMap = new Map<number, VariantRow>();
    if (variantIds.length) {
      const vRes = await db.query<VariantRow>(
        `select id, product_id, price_jod
           from product_variants
          where id = any($1::bigint[])
            and is_active=true`,
        [variantIds]
      );
      for (const v of vRes.rows) variantMap.set(v.id, v);
    }

    const lines: PricedOrderLine[] = [];
    for (const item of normalized) {
      const product = productMap.get(item.slug);
      if (!product || !product.is_active) {
        return NextResponse.json(
          { ok: false, error: locale === "ar" ? "يوجد منتج غير صالح في السلة" : "Cart contains invalid product" },
          { status: 400 }
        );
      }

      let unitPrice = Number(product.unit_price_jod || 0);
      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || Number(variant.product_id) !== Number(product.id)) {
          return NextResponse.json(
            { ok: false, error: locale === "ar" ? "النسخة المختارة غير صالحة" : "Selected variant is invalid" },
            { status: 400 }
          );
        }
        unitPrice = Number(variant.price_jod || 0);
      }

      lines.push({
        slug: item.slug,
        qty: item.qty,
        category_key: product.category_key,
        line_total_jod: Number((unitPrice * item.qty).toFixed(2)),
      });
    }

    const subtotal = Number(lines.reduce((sum, line) => sum + line.line_total_jod, 0).toFixed(2));
    const result = await evaluatePromoCodeForLines(db, promoCode, lines, subtotal);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: locale === "ar" ? "الخصم غير صالح أو غير متاح" : "Discount is invalid or not eligible",
          reason: result.code,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      promo: {
        mode: "CODE",
        promotionId: result.promotionId,
        code: result.promoCode,
        discountJod: result.discountJod,
        subtotalAfterDiscountJod: result.subtotalAfterDiscountJod,
        eligibleSubtotalJod: result.eligibleSubtotalJod,
        ...result.meta,
      },
    });
  } catch (error: unknown) {
    if (isDbConnectivityError(error)) {
      return NextResponse.json(
        { ok: false, error: "Promotion validation temporarily unavailable", reason: "DB_CONNECTIVITY" },
        { status: 503 }
      );
    }
    throw error;
  }
}
