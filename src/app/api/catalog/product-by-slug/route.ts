import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe, isRecoverableCatalogSetupError } from "@/lib/catalog";
import { fallbackProductBySlug, syntheticVariantId } from "@/lib/catalogFallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price_jod: string | number;
  is_active: boolean;
  variant_id: number | null;
  variant_label: string | null;
  variant_price_jod: string | number | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });

  try {
    const bootstrap = await ensureCatalogTablesSafe();
    if (!bootstrap.ok) {
      const fallback = fallbackProductBySlug(slug);
      if (!fallback) {
        return NextResponse.json(
          { ok: false, error: "Catalog temporarily unavailable", reason: bootstrap.reason },
          { status: 503, headers: { "cache-control": "no-store" } }
        );
      }

      const defaultVariant = fallback.variants?.find((v) => v.isDefault) || fallback.variants?.[0] || null;
      return NextResponse.json(
        {
          ok: true,
          fallback: true,
          reason: bootstrap.reason,
          product: {
            slug: fallback.slug,
            name_en: fallback.name.en,
            name_ar: fallback.name.ar,
            description_en: fallback.description.en,
            description_ar: fallback.description.ar,
            price_jod: Number(defaultVariant?.priceJod ?? fallback.priceJod),
            variant_id: defaultVariant ? syntheticVariantId(fallback.slug) : null,
            variant_label: defaultVariant?.sizeLabel ?? null,
            is_active: true,
          },
        },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }

    const r = await db.query<ProductRow>(
      `select p.slug, p.name_en, p.name_ar, p.description_en, p.description_ar, p.price_jod, p.is_active,
              dv.id::int as variant_id,
              dv.label as variant_label,
              dv.price_jod::text as variant_price_jod
         from products p
         left join lateral (
           select v.id, v.label, v.price_jod
             from product_variants v
            where v.product_id=p.id and v.is_active=true
            order by v.is_default desc, v.price_jod asc, v.sort_order asc, v.id asc
            limit 1
         ) dv on true
        where p.slug=$1
        limit 1`,
      [slug]
    );

    const p = r.rows?.[0];
    if (!p || !p.is_active) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        ok: true,
        product: {
          slug: p.slug,
          name_en: p.name_en,
          name_ar: p.name_ar,
          description_en: p.description_en,
          description_ar: p.description_ar,
          price_jod: Number((p.variant_price_jod ?? p.price_jod) || 0),
          variant_id: p.variant_id,
          variant_label: p.variant_label,
          is_active: !!p.is_active,
        },
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (error: unknown) {
    if (!isDbConnectivityError(error) && !isRecoverableCatalogSetupError(error)) throw error;

    const p = fallbackProductBySlug(slug);
    if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const reason = isDbConnectivityError(error) ? "DB_CONNECTIVITY" : "CATALOG_RECOVERABLE_ERROR";
    console.warn(`[api/catalog/product-by-slug] Serving fallback payload due to ${reason}.`);

    const defaultVariant = p.variants?.find((v) => v.isDefault) || p.variants?.[0] || null;
    return NextResponse.json(
      {
        ok: true,
        fallback: true,
        reason,
        product: {
          slug: p.slug,
          name_en: p.name.en,
          name_ar: p.name.ar,
          description_en: p.description.en,
          description_ar: p.description.ar,
          price_jod: Number(defaultVariant?.priceJod ?? p.priceJod),
          variant_id: defaultVariant ? syntheticVariantId(p.slug) : null,
          variant_label: defaultVariant?.sizeLabel ?? null,
          is_active: true,
        },
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }
}
