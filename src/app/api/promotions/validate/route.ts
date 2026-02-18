import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import {
  evaluatePromoCodeForLines,
  type PricedOrderLine,
} from "@/lib/promotions";

type PromoMode = "CODE" | "AUTO";

type IncomingItem = { slug?: string; qty?: number; variantId?: number | null };
type ProductRow = { slug: string; category_key: string | null; is_active: boolean };
type VariantRow = { id: number; product_slug: string; price_jod: string | number };
type FallbackPriceRow = { slug: string; price_jod: string | number };

function normalizeItems(items: unknown): { slug: string; qty: number; variantId: number | null }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => {
      const slug = String(x?.slug || "").trim();
      const qtyNum = Number(x?.qty ?? 1);
      const qty = Number.isFinite(qtyNum) ? Math.max(1, Math.min(99, qtyNum)) : 1;

      const rawVid = Number(x?.variantId);
      const variantId = Number.isFinite(rawVid) ? rawVid : null;

      return { slug, qty, variantId };
    })
    .filter((x) => x.slug.length > 0);
}

function pickMode(v: unknown): PromoMode {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "AUTO" ? "AUTO" : "CODE";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureCatalogTables();

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const locale = body.locale === "ar" ? "ar" : "en";
  const mode = pickMode(body.mode);

  const promoCode = String(body.promoCode || "").trim().toUpperCase();
  const normalized = normalizeItems(body.items);

  if (!normalized.length) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "السلة فارغة" : "Cart items are required" },
      { status: 400 }
    );
  }

  // Mode-specific validation
  if (mode === "CODE" && !promoCode) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "أدخل كود الخصم" : "Promo code is required" },
      { status: 400 }
    );
  }
  if (mode === "AUTO" && promoCode) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "لا يمكن استخدام كود مع خصم AUTO" : "Promo code cannot be used with AUTO mode" },
      { status: 400 }
    );
  }

  const slugs = Array.from(new Set(normalized.map((i) => i.slug)));

  const productRes = await db.query<ProductRow>(
    `select slug, category_key, is_active
       from products
      where slug = any($1::text[])`,
    [slugs]
  );
  const productMap = new Map(productRes.rows.map((p) => [p.slug, p]));

  const variantIds = Array.from(
    new Set(
      normalized
        .map((i) => i.variantId)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
    )
  );

  const variantMap = new Map<number, VariantRow>();
  if (variantIds.length) {
    const vRes = await db.query<VariantRow>(
      `select v.id, p.slug as product_slug, v.price_jod
         from product_variants v
         join products p on p.id = v.product_id
        where v.id = any($1::bigint[])
          and v.is_active = true`,
      [variantIds]
    );
    for (const v of vRes.rows) variantMap.set(v.id, v);
  }

  // Prefetch fallback prices once (avoid per-line query)
  const fallbackSlugs = Array.from(
    new Set(normalized.filter((i) => i.variantId == null).map((i) => i.slug))
  );

  const fallbackPriceMap = new Map<string, number>();
  if (fallbackSlugs.length) {
    const fRes = await db.query<FallbackPriceRow>(
      `select p.slug,
              coalesce(
                (
                  select v.price_jod
                    from product_variants v
                   where v.product_id = (select id from products where slug = p.slug limit 1)
                     and v.is_active = true
                   order by v.is_default desc, v.price_jod asc, v.sort_order asc, v.id asc
                   limit 1
                ),
                (select price_jod from products where slug = p.slug limit 1)
              )::text as price_jod
         from products p
        where p.slug = any($1::text[])`,
      [fallbackSlugs]
    );

    for (const row of fRes.rows) {
      const n = Number(row.price_jod ?? 0);
      fallbackPriceMap.set(row.slug, Number.isFinite(n) ? n : 0);
    }
  }

  const lines: PricedOrderLine[] = [];

  for (const item of normalized) {
    const prod = productMap.get(item.slug);
    if (!prod || !prod.is_active) {
      return NextResponse.json(
        { ok: false, error: locale === "ar" ? "يوجد منتج غير صالح في السلة" : "Cart contains invalid product" },
        { status: 400 }
      );
    }

    let unit = 0;

    if (item.variantId != null) {
      const v = variantMap.get(item.variantId);
      if (!v || v.product_slug !== item.slug) {
        return NextResponse.json(
          { ok: false, error: locale === "ar" ? "النسخة المختارة غير صالحة" : "Selected variant is invalid" },
          { status: 400 }
        );
      }
      const n = Number(v.price_jod ?? 0);
      unit = Number.isFinite(n) ? n : 0;
    } else {
      unit = fallbackPriceMap.get(item.slug) ?? 0;
    }

    const lineTotal = Number((unit * item.qty).toFixed(2));
    lines.push({
      slug: item.slug,
      qty: item.qty,
      category_key: prod.category_key,
      line_total_jod: lineTotal,
    });
  }

  const subtotal = Number(lines.reduce((sum, line) => sum + line.line_total_jod, 0).toFixed(2));

  // AUTO mode (placeholder: no discount unless you add auto-promo evaluator later)
  if (mode === "AUTO") {
    return NextResponse.json({
      ok: true,
      promo: {
        mode,
        promotionId: null,
        code: "",
        discountJod: 0,
        subtotalAfterDiscountJod: subtotal,
        eligibleSubtotalJod: subtotal,
      },
    });
  }

  // CODE mode
  const result = await evaluatePromoCodeForLines(db, promoCode, lines, subtotal);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: locale === "ar" ? "الخصم غير صالح أو غير متاح" : "Discount is invalid or not eligible",
        reason: result.code,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    promo: {
      mode,
      promotionId: result.promotionId,
      code: result.promoCode,
      discountJod: result.discountJod,
      subtotalAfterDiscountJod: result.subtotalAfterDiscountJod,
      eligibleSubtotalJod: result.eligibleSubtotalJod,
      ...result.meta,
    },
  });
}
