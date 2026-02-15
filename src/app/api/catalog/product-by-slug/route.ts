import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureCatalogTables();

  const url = new URL(req.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  if (!slug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });

  const r = await db.query(
    `select slug, name_en, name_ar, price_jod::text as price_jod, inventory_qty
       from products
      where slug=$1
      limit 1`,
    [slug]
  );

  const row = r.rows[0] as any;
  if (!row) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  return Response.json({
    ok: true,
    product: {
      slug: row.slug,
      name_en: row.name_en,
      name_ar: row.name_ar,
      price_jod: row.price_jod,
      inventory_qty: Number(row.inventory_qty || 0),
    },
  });
}
