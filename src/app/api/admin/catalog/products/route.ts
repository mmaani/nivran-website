import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSlug(v: unknown) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  await ensureCatalogTables();
  const form = await req.formData();
  const action = String(form.get("action") || "create");

  if (action === "create") {
    const slug = normalizeSlug(form.get("slug"));
    const nameEn = String(form.get("name_en") || "").trim();
    const nameAr = String(form.get("name_ar") || "").trim();
    const descriptionEn = String(form.get("description_en") || "").trim() || null;
    const descriptionAr = String(form.get("description_ar") || "").trim() || null;
    const price = Number(form.get("price_jod") || 0);
    const compareAt = String(form.get("compare_at_price_jod") || "").trim();
    const inventory = Math.max(0, Number(form.get("inventory_qty") || 0));
    const categoryKey = String(form.get("category_key") || "perfume").trim() || "perfume";
    const isActive = String(form.get("is_active") || "") === "on";

    if (!slug || !nameEn || !nameAr || !Number.isFinite(price) || price <= 0) {
      return NextResponse.redirect(new URL("/admin/catalog?error=invalid-product", req.url));
    }

    await db.query(
      `insert into products
        (slug, slug_en, slug_ar, category_key, name_en, name_ar, description_en, description_ar, price_jod, compare_at_price_jod, inventory_qty, is_active)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (slug) do update
         set slug_en=excluded.slug_en,
             slug_ar=excluded.slug_ar,
             category_key=excluded.category_key,
             name_en=excluded.name_en,
             name_ar=excluded.name_ar,
             description_en=excluded.description_en,
             description_ar=excluded.description_ar,
             price_jod=excluded.price_jod,
             compare_at_price_jod=excluded.compare_at_price_jod,
             inventory_qty=excluded.inventory_qty,
             is_active=excluded.is_active,
             updated_at=now()`,
      [
        slug,
        slug,
        slug,
        categoryKey,
        nameEn,
        nameAr,
        descriptionEn,
        descriptionAr,
        price,
        compareAt ? Number(compareAt) : null,
        inventory,
        isActive,
      ]
    );
  }

  if (action === "update") {
    const id = Number(form.get("id") || 0);
    const price = Number(form.get("price_jod") || 0);
    const compareAt = String(form.get("compare_at_price_jod") || "").trim();
    const inventory = Math.max(0, Number(form.get("inventory_qty") || 0));
    const categoryKey = String(form.get("category_key") || "").trim();
    const isActive = String(form.get("is_active") || "") === "on";

    if (id > 0) {
      await db.query(
        `update products
           set price_jod=$2,
               compare_at_price_jod=$3,
               inventory_qty=$4,
               category_key=coalesce(nullif($5,''), category_key),
               is_active=$6,
               updated_at=now()
         where id=$1`,
        [id, price, compareAt ? Number(compareAt) : null, inventory, categoryKey, isActive]
      );
    }
  }

  if (action === "delete") {
    const id = Number(form.get("id") || 0);
    if (id > 0) {
      await db.query(`delete from product_images where product_id=$1`, [id]);
      await db.query(`delete from products where id=$1`, [id]);
    }
  }

  return NextResponse.redirect(new URL("/admin/catalog?saved=1", req.url));
}
