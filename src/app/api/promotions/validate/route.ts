import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import {
  evaluateAutomaticPromotionForLines,
  evaluatePromoCodeForLines,
  type PricedOrderLine,
} from "@/lib/promotions";

type IncomingItem = { slug?: string; variantId?: number; qty?: number };
type ProductRow = { slug: string; category_key: string | null; is_active: boolean };
type VariantRow = { slug: string; id: number; price_jod: string | number; is_active: boolean; is_default: boolean; sort_order: number };

function normalizeItems(items: unknown): { slug: string; variantId: number | null; qty: number }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
      variantId: Number.isFinite(Number(x?.variantId || 0)) && Number(x?.variantId || 0) > 0 ? Math.floor(Number(x?.variantId || 0)) : null,
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
    }))
    .filter((x) => x.slug.length > 0);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureCatalogTables();

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const locale = body.locale === "ar" ? "ar" : "en";
  const mode = String(body.mode || "CODE").toUpperCase() === "AUTO" ? "AUTO" : "CODE";
  const promoCode = String(body.promoCode || "").trim().toUpperCase();
  const normalized = normalizeItems(body.items);

  if (normalized.length === 0) {
    return NextResponse.json({ ok: false, error: locale === "ar" ? "السلة فارغة" : "Cart items are required" }, { status: 400 });
  }

  if (mode === "CODE" && !promoCode) {
    return NextResponse.json({ ok: false, error: locale === "ar" ? "أدخل كود الخصم" : "Promo code is required" }, { status: 400 });
  }

  const slugs = Array.from(new Set(normalized.map((i) => i.slug)));
  const productRes = await db.query<ProductRow>(
    `select slug, category_key, is_active
       from products
      where slug = any($1::text[])`,
    [slugs]
  );

  const map = new Map<string, ProductRow>();
  for (const p of productRes.rows) map.set(p.slug, p);

  const variantsRes = await db.query<VariantRow>(`
    select p.slug, v.id, v.price_jod, v.is_active, v.is_default, v.sort_order
      from product_variants v
      join products p on p.id=v.product_id
     where p.slug = any($1::text[])`, [slugs]);
  const variantMap = new Map<string, VariantRow[]>();
  for (const v of variantsRes.rows) {
    const arr = variantMap.get(v.slug) || [];
    arr.push(v);
    variantMap.set(v.slug, arr);
  }

  const lines: PricedOrderLine[] = [];
  for (const item of normalized) {
    const prod = map.get(item.slug);
    if (!prod || !prod.is_active) {
      return NextResponse.json(
        { ok: false, error: locale === "ar" ? "يوجد منتج غير صالح في السلة" : "Cart contains invalid product" },
        { status: 400 }
      );
    }
    const list = (variantMap.get(item.slug) || []).filter((v) => v.is_active).sort((a,b)=>(a.is_default===b.is_default? a.sort_order-b.sort_order : (a.is_default?-1:1)));
    const selected = (item.variantId ? list.find((v)=>v.id===item.variantId) : null) || list[0];
    if (!selected) return NextResponse.json({ ok: false, error: locale === "ar" ? "لا يوجد متغير صالح" : "No valid variant" }, { status: 400 });
    const unit = Number(selected.price_jod || 0);
    const lineTotal = Number((unit * item.qty).toFixed(2));
    lines.push({ slug: item.slug, qty: item.qty, category_key: prod.category_key, line_total_jod: lineTotal });
  }

  const subtotal = Number(lines.reduce((sum, line) => sum + line.line_total_jod, 0).toFixed(2));
  const result =
    mode === "AUTO"
      ? await evaluateAutomaticPromotionForLines(db, lines, subtotal)
      : await evaluatePromoCodeForLines(db, promoCode, lines, subtotal);

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
