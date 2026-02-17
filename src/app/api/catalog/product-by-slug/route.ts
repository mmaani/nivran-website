import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });

  await ensureCatalogTables();

  const r = await db.query(
    `select p.slug, p.name_en, p.name_ar, p.description_en, p.description_ar, p.is_active,
            coalesce(v.id,0) as variant_id, coalesce(v.label,'Standard') as variant_label, coalesce(v.price_jod,p.price_jod) as price_jod
       from products p
       left join lateral (
         select id, label, price_jod
         from product_variants
         where product_id=p.id and is_active=true
         order by is_default desc, price_jod asc, sort_order asc, id asc
         limit 1
       ) v on true
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
        variant_id: Number(p.variant_id || 0),
        variant_label: String(p.variant_label || ""),
        price_jod: Number(p.price_jod || 0),
        is_active: !!p.is_active,
      },
    },
    { status: 200 }
  );
}
