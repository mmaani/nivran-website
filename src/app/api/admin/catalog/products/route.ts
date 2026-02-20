import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickMulti(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

function normalizeSlug(v: unknown) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function normalizeDigits(value: string): string {
  // Arabic-Indic (٠١٢٣٤٥٦٧٨٩) + Eastern Arabic (۰۱۲۳۴۵۶۷۸۹)
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return value.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function parseLocaleNumber(input: unknown): number | null {
  const raw = normalizeDigits(String(input ?? "").trim());
  if (!raw) return null;

  // Arabic decimal/thousands separators
  let s = raw.replace(/٬/g, "").replace(/٫/g, ".");

  // If only comma exists, treat it as decimal separator; otherwise, strip commas.
  if (s.includes(",") && !s.includes(".")) s = s.replace(/,/g, ".");
  else s = s.replace(/,/g, "");

  s = s.replace(/\s+/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let form: FormData | null = null;
  try {
    form = await req.formData();
    const auth = requireAdmin(req);
    if (!auth.ok) {
      const accept = req.headers.get("accept") || "";
      if (accept.includes("text/html")) return catalogUnauthorizedRedirect(req, form);
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    await ensureCatalogTablesSafe();
    const action = String(form.get("action") || "create");

    if (action === "create") {
      const slug = normalizeSlug(form.get("slug"));
      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const descriptionEn = String(form.get("description_en") || "").trim() || null;
      const descriptionAr = String(form.get("description_ar") || "").trim() || null;
      const price = parseLocaleNumber(form.get("price_jod"));
      const compareAt = parseLocaleNumber(form.get("compare_at_price_jod"));
      const inventoryRaw = parseLocaleNumber(form.get("inventory_qty"));
      const inventory = inventoryRaw == null ? 0 : Math.max(0, Math.trunc(inventoryRaw));
      const categoryKey = String(form.get("category_key") || "perfume").trim() || "perfume";
      const isActive = String(form.get("is_active") || "") === "on";
      const wearTimes = pickMulti(form, "wear_times");
      const seasons = pickMulti(form, "seasons");
      const audiences = pickMulti(form, "audiences");

      if (!slug || !nameEn || !nameAr || price == null || price <= 0) {
        return catalogErrorRedirect(req, form, "invalid-product");
      }

      await db.query(
        `insert into products
          (slug, slug_en, slug_ar, category_key, name_en, name_ar, description_en, description_ar, price_jod, compare_at_price_jod, inventory_qty, is_active, wear_times, seasons, audiences)
         values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14::text[],$15::text[])
         on conflict (slug_en) do update
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
               wear_times=excluded.wear_times,
               seasons=excluded.seasons,
               audiences=excluded.audiences,
               updated_at=now()`,
        [slug, slug, slug, categoryKey, nameEn, nameAr, descriptionEn, descriptionAr, price, compareAt, inventory, isActive, wearTimes, seasons, audiences]
      );
    }

    if (action === "update") {
      const id = Number(form.get("id") || 0);
      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const descriptionEn = String(form.get("description_en") || "").trim();
      const descriptionAr = String(form.get("description_ar") || "").trim();
      const price = parseLocaleNumber(form.get("price_jod"));
      const compareAt = parseLocaleNumber(form.get("compare_at_price_jod"));
      const inventoryRaw = parseLocaleNumber(form.get("inventory_qty"));
      const inventory = inventoryRaw == null ? null : Math.max(0, Math.trunc(inventoryRaw));
      const categoryKey = String(form.get("category_key") || "").trim();
      const isActive = String(form.get("is_active") || "") === "on";
      const wearTimes = pickMulti(form, "wear_times");
      const seasons = pickMulti(form, "seasons");
      const audiences = pickMulti(form, "audiences");

      if (id > 0) {
        await db.query(
          `update products
             set name_en=case when nullif($2,'') is null then name_en else $2 end,
                 name_ar=case when nullif($3,'') is null then name_ar else $3 end,
                 description_en=case when $4 is null then description_en else $4 end,
                 description_ar=case when $5 is null then description_ar else $5 end,
                 price_jod=case when $6 is not null and $6 > 0 then $6 else price_jod end,
                 compare_at_price_jod=$7,
                 inventory_qty=coalesce($8, inventory_qty),
                 category_key=coalesce(nullif($9,''), category_key),
                 is_active=$10,
                 wear_times=$11::text[],
                 seasons=$12::text[],
                 audiences=$13::text[],
                 updated_at=now()
           where id=$1`,
          [id, nameEn, nameAr, descriptionEn || null, descriptionAr || null, price, compareAt, inventory, categoryKey, isActive, wearTimes, seasons, audiences]
        );
      }
    }

    if (action === "clone") {
      const id = Number(form.get("id") || 0);
      if (id > 0) {
        const source = await db.query<{
          slug: string;
          slug_en: string | null;
          slug_ar: string | null;
          category_key: string;
          name_en: string;
          name_ar: string;
          description_en: string | null;
          description_ar: string | null;
          price_jod: string;
          compare_at_price_jod: string | null;
          inventory_qty: number;
          is_active: boolean;
          wear_times: string[];
          seasons: string[];
          audiences: string[];
        }>(`select slug, slug_en, slug_ar, category_key, name_en, name_ar, description_en, description_ar, price_jod::text, compare_at_price_jod::text, inventory_qty, is_active, coalesce(wear_times, '{}'::text[]) as wear_times, coalesce(seasons, '{}'::text[]) as seasons, coalesce(audiences, '{}'::text[]) as audiences from products where id=$1`, [id]);

        const base = source.rows[0];
        if (!base) return catalogErrorRedirect(req, form, "product-not-found");

        let nextSlug = `${base.slug}-copy`;
        let suffix = 2;
        while (true) {
          const exists = await db.query<{ id: number }>(`select id from products where slug=$1 limit 1`, [nextSlug]);
          if (!exists.rows[0]) break;
          nextSlug = `${base.slug}-copy-${suffix}`;
          suffix += 1;
        }

        await db.query(
          `insert into products
            (slug, slug_en, slug_ar, category_key, name_en, name_ar, description_en, description_ar, price_jod, compare_at_price_jod, inventory_qty, is_active, wear_times, seasons, audiences)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14::text[],$15::text[])`,
          [
            nextSlug,
            nextSlug,
            nextSlug,
            base.category_key,
            `${base.name_en} (Copy)`,
            `${base.name_ar} (نسخة)`,
            base.description_en,
            base.description_ar,
            Number(base.price_jod || 0),
            base.compare_at_price_jod ? Number(base.compare_at_price_jod) : null,
            0,
            false,
            base.wear_times,
            base.seasons,
            base.audiences,
          ]
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

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/products] route error", error);
    return catalogErrorRedirect(req, form, "products-save-failed");
  }
}
