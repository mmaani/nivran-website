import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { products as staticProducts } from "@/lib/siteContent";

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
    await ensureCatalogTables();

    const r = await db.query<ProductRow>(
      `select p.slug, p.name_en, p.name_ar, p.description_en, p.description_ar, p.price_jod, p.is_active,
              dv.id as variant_id,
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
    if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

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
      { status: 200 }
    );
  } catch (error: unknown) {
    if (!isDbConnectivityError(error)) throw error;

    const p = staticProducts.find((item) => item.slug === slug);
    if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const defaultVariant = p.variants?.find((v) => v.isDefault) || p.variants?.[0] || null;
    return NextResponse.json(
      {
        ok: true,
        product: {
          slug: p.slug,
          name_en: p.name.en,
          name_ar: p.name.ar,
          description_en: p.description.en,
          description_ar: p.description.ar,
          price_jod: Number(defaultVariant?.priceJod ?? p.priceJod),
          variant_id: defaultVariant ? 10000 : null,
          variant_label: defaultVariant?.sizeLabel ?? null,
          is_active: true,
        },
      },
      { status: 200 }
    );
  }
}
