import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import {
  evaluateAutomaticPromotionForLines,
  evaluatePromoCodeForLines,
  type PricedOrderLine,
} from "@/lib/promotions";

type IncomingItem = { slug?: string; qty?: number };
type ProductRow = { slug: string; price_jod: string | number; category_key: string | null; is_active: boolean };

function normalizeItems(items: unknown): { slug: string; qty: number }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
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
    `select slug, price_jod, category_key, is_active
       from products
      where slug = any($1::text[])`,
    [slugs]
  );

  const map = new Map<string, ProductRow>();
  for (const p of productRes.rows) map.set(p.slug, p);

  const lines: PricedOrderLine[] = [];
  for (const item of normalized) {
    const prod = map.get(item.slug);
    if (!prod || !prod.is_active) {
      return NextResponse.json(
        { ok: false, error: locale === "ar" ? "يوجد منتج غير صالح في السلة" : "Cart contains invalid product" },
        { status: 400 }
      );
    }
    const unit = Number(prod.price_jod || 0);
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
