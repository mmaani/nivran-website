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
    `select slug, name_en, name_ar, description_en, description_ar, price_jod, is_active
       from products
      where slug=$1
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
        price_jod: Number(p.price_jod || 0),
        is_active: !!p.is_active,
      },
    },
    { status: 200 }
  );
}
