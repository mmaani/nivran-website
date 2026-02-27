import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";

export const runtime = "nodejs";

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  price_jod: string;
  inventory_qty: number;
  variants_json: unknown;
};

function parseVariants(value: unknown): Array<{ id: number; label: string; size_ml: number | null; price_jod: string; is_default: boolean }> {
  if (!Array.isArray(value)) return [];
  const parsed: Array<{ id: number; label: string; size_ml: number | null; price_jod: string; is_default: boolean }> = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;

    const id = Number(row.id || 0);
    const label = String(row.label || "").trim();
    const sizeRaw = Number(row.size_ml || 0);
    const sizeMl = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.trunc(sizeRaw) : null;
    const price = String(row.price_jod || "0");
    const isDefault = row.is_default === true;

    if (id <= 0 || !label) continue;
    parsed.push({ id, label, size_ml: sizeMl, price_jod: price, is_default: isDefault });
  }

  return parsed;
}

export async function GET(req: Request) {
  const auth = requireAdminOrSales(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const products = await db.query<ProductRow>(
    `select
       p.id,
       p.slug,
       p.name_en,
       p.name_ar,
       p.price_jod::text as price_jod,
       p.inventory_qty,
       coalesce(
         (
           select jsonb_agg(
             jsonb_build_object(
               'id', v.id,
               'label', v.label,
               'size_ml', v.size_ml,
               'price_jod', v.price_jod::text,
               'is_default', v.is_default
             )
             order by v.sort_order asc, v.id asc
           )
           from product_variants v
           where v.product_id = p.id
             and v.is_active = true
         ),
         '[]'::jsonb
       ) as variants_json
     from products p
     where p.is_active=true
     order by p.updated_at desc
     limit 400`
  );

  const promotions = await db.query<{ id: number; code: string | null; title_en: string | null; title_ar: string | null; discount_type: string; discount_value: string }>(
    `select id, code, title_en, title_ar, discount_type, discount_value::text
       from promotions
      where is_active=true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
      order by priority desc, created_at desc
      limit 200`
  );

  const normalizedProducts = products.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name_en: row.name_en,
    name_ar: row.name_ar,
    price_jod: row.price_jod,
    inventory_qty: row.inventory_qty,
    variants: parseVariants(row.variants_json),
  }));

  return NextResponse.json({ ok: true, products: normalizedProducts, promotions: promotions.rows });
}
