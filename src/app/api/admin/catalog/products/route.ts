import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureCatalogTables();
  const form = await req.formData();
  const action = String(form.get("action") || "create");

  if (action === "create") {
    const slug = String(form.get("slug") || "").trim().toLowerCase();
    const nameEn = String(form.get("name_en") || "").trim();
    const nameAr = String(form.get("name_ar") || "").trim();
    const descriptionEn = String(form.get("description_en") || "").trim() || null;
    const descriptionAr = String(form.get("description_ar") || "").trim() || null;
    const price = Number(form.get("price_jod") || 0);
    const compareAt = String(form.get("compare_at_price_jod") || "").trim();
    const inventory = Math.max(0, Number(form.get("inventory_qty") || 0));
    const isActive = String(form.get("is_active") || "") === "on";

    if (!slug || !nameEn || !nameAr || !Number.isFinite(price) || price <= 0) {
      return NextResponse.redirect(new URL("/admin/catalog?error=invalid-product", req.url));
    }

    await db.query(
      `insert into products (slug, name_en, name_ar, description_en, description_ar, price_jod, compare_at_price_jod, inventory_qty, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (slug) do update
         set name_en=excluded.name_en,
             name_ar=excluded.name_ar,
             description_en=excluded.description_en,
             description_ar=excluded.description_ar,
             price_jod=excluded.price_jod,
             compare_at_price_jod=excluded.compare_at_price_jod,
             inventory_qty=excluded.inventory_qty,
             is_active=excluded.is_active,
             updated_at=now()`,
      [slug, nameEn, nameAr, descriptionEn, descriptionAr, price, compareAt ? Number(compareAt) : null, inventory, isActive]
    );
  }

  if (action === "update") {
    const id = Number(form.get("id") || 0);
    const price = Number(form.get("price_jod") || 0);
    const compareAt = String(form.get("compare_at_price_jod") || "").trim();
    const inventory = Math.max(0, Number(form.get("inventory_qty") || 0));
    const isActive = String(form.get("is_active") || "") === "on";
    if (id > 0) {
      await db.query(
        `update products
           set price_jod=$2,
               compare_at_price_jod=$3,
               inventory_qty=$4,
               is_active=$5,
               updated_at=now()
         where id=$1`,
        [id, price, compareAt ? Number(compareAt) : null, inventory, isActive]
      );
    }
  }

  return NextResponse.redirect(new URL("/admin/catalog?saved=1", req.url));
}
