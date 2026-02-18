import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { fallbackProductBySlug } from "@/lib/catalogFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  id: number;
  slug: string;
  slug_en: string | null;
  slug_ar: string | null;
  name_en: string | null;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  price_jod: number | string | null;
  compare_at_price_jod: number | string | null;
  inventory_qty: number | string | null;
  category_key: string | null;
  is_active: boolean;
};

type ProductImageRow = {
  id: number;
  position: number | null;
};

type PromotionRow = {
  id: number;
  promo_kind: string | null;
  code: string | null;
  title_en: string | null;
  title_ar: string | null;
  discount_type: string | null; // "PERCENT" | "FIXED" (keep flexible)
  discount_value: number | string | null;
  category_keys: string[] | null;
};

function computeDiscountedPrice(base: number, promo: PromotionRow | null): number {
  if (!promo) return base;

  const t = String(promo.discount_type || "").toUpperCase();
  const v = Number(promo.discount_value || 0);
  if (!Number.isFinite(v) || v <= 0) return base;

  const discount =
    t === "PERCENT" ? base * (v / 100) :
    t === "FIXED" ? v :
    0;

  const final = Math.max(0, base - discount);
  return Math.round(final * 100) / 100;
}

function nowSql() {
  return "now()";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  const idRaw = url.searchParams.get("id");
  const idNum = idRaw ? Number(idRaw) : 0;
  const id = Number.isFinite(idNum) && idNum > 0 ? idNum : 0;

  if (!slug && !id) {
    return NextResponse.json({ ok: false, error: "Provide slug or id" }, { status: 400 });
  }

  try {
    await ensureCatalogTables();

    const pr = await db.query<ProductRow>(
    `select id, slug, slug_en, slug_ar, name_en, name_ar, description_en, description_ar,
            price_jod, compare_at_price_jod, inventory_qty, category_key, is_active
       from products
      where ${id ? "id=$1" : "slug=$1"}
      limit 1`,
    [id ? id : slug]
  );

    const product = pr.rows[0];
    if (!product || !product.is_active) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const imgRes = await db.query<ProductImageRow>(
    `select id, "position"::int as position
       from product_images
      where product_id=$1
      order by "position" asc nulls last, id asc`,
    [product.id]
  );

    const promoRes = await db.query<PromotionRow>(
    `select id, promo_kind, code, title_en, title_ar, discount_type, discount_value, category_keys
       from promotions
      where is_active=true and promo_kind='AUTO'
        and (starts_at is null or starts_at <= ${nowSql()})
        and (ends_at is null or ends_at >= ${nowSql()})
        and (
          category_keys is null
          or array_length(category_keys, 1) is null
          or $1 = any(category_keys)
        )
      order by created_at desc
      limit 1`,
    [product.category_key]
  );

    const promo = promoRes.rows[0] ?? null;

    const base = Number(product.price_jod || 0);
    const final = computeDiscountedPrice(base, promo);

    return NextResponse.json({
      ok: true,
      product: {
        id: product.id,
        slug: product.slug,
        category_key: product.category_key,
        name_en: product.name_en,
        name_ar: product.name_ar,
        description_en: product.description_en,
        description_ar: product.description_ar,
        price_jod: base,
        final_price_jod: final,
        compare_at_price_jod: product.compare_at_price_jod != null ? Number(product.compare_at_price_jod) : null,
        inventory_qty: Number(product.inventory_qty || 0),
        images: imgRes.rows.map((r) => ({
          id: r.id,
          url: `/api/catalog/product-image/${r.id}`,
        })),
      },
      promotion: promo
        ? {
            id: promo.id,
            code: promo.code,
            title_en: promo.title_en,
            title_ar: promo.title_ar,
            discount_type: promo.discount_type,
            discount_value: Number(promo.discount_value || 0),
            category_keys: promo.category_keys || null,
          }
        : null,
    });
  } catch (error: unknown) {
    if (!isDbConnectivityError(error)) throw error;

    const fallback = slug ? fallbackProductBySlug(slug) : null;

    if (!fallback) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    console.warn("[api/catalog/product] Serving fallback payload due to DB connectivity issue.");

    const base = Number(fallback.priceJod || 0);
    const image = fallback.images?.[0] || "";

    return NextResponse.json({
      ok: true,
      product: {
        id: 0,
        slug: fallback.slug,
        category_key: fallback.category,
        name_en: fallback.name.en,
        name_ar: fallback.name.ar,
        description_en: fallback.description.en,
        description_ar: fallback.description.ar,
        price_jod: base,
        final_price_jod: base,
        compare_at_price_jod: null,
        inventory_qty: 99,
        images: image ? [{ id: 0, url: image }] : [],
      },
      promotion: null,
    });
  }
}
