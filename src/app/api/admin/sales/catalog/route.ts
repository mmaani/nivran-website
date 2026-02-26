import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireAdminOrSales(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const products = await db.query<{ id: number; slug: string; name_en: string; name_ar: string; price_jod: string; inventory_qty: number }>(
    `select id, slug, name_en, name_ar, price_jod::text, inventory_qty
       from products
      where is_active=true
      order by updated_at desc
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

  return NextResponse.json({ ok: true, products: products.rows, promotions: promotions.rows });
}
