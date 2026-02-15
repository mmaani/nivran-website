import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowSql() {
  return "now()";
}

function computeDiscountedPrice(base: number, promo: any | null): number {
  if (!promo) return base;
  const t = String(promo.discount_type || "").toUpperCase();
  const v = Number(promo.discount_value || 0);
  if (!Number.isFinite(v) || v <= 0) return base;

  let discount = 0;
  if (t === "PERCENT") discount = base * (v / 100);
  else if (t === "FIXED") discount = v;

  const final = Math.max(0, base - discount);
  return Math.round(final * 100) / 100;
}

export async function GET(req: Request) {
  await ensureCatalogTables();
  const url = new URL(req.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  const id = Number(url.searchParams.get("id") || 0);

  if (!slug && !id) {
    return NextResponse.json({ ok: false, error: "Provide slug or id" }, { status: 400 });
  }

  const pr = await db.query(
    `select id, slug, slug_en, slug_ar, name_en, name_ar, description_en, description_ar, price_jod, compare_at_price_jod,
            inventory_qty, category_key, is_active
       from products
      where ${id ? "id=$1" : "slug=$1"}
      limit 1`,
    [id ? id : slug]
  );

  const product = pr.rows[0] as any;
  if (!product || !product.is_active) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const imgRes = await db.query(
    `select id, "position"
       from product_images
      where product_id=$1
      order by "position" asc, id asc`,
    [product.id]
  );

  const promoRes = await db.query(
    `select id, code, title_en, title_ar, discount_type, discount_value, category_keys
       from promotions
      where is_active=true
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

  const promo = (promoRes.rows[0] as any) || null;

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
      compare_at_price_jod: product.compare_at_price_jod ? Number(product.compare_at_price_jod) : null,
      inventory_qty: Number(product.inventory_qty || 0),
      images: imgRes.rows.map((r: any) => ({
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
          discount_value: Number(promo.discount_value),
          category_keys: promo.category_keys || null,
        }
      : null,
  });
}
