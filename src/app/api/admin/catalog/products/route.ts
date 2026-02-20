import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import {
  catalogErrorRedirect,
  catalogReturnPath,
  catalogSavedRedirect,
  catalogUnauthorizedRedirect,
} from "../redirects";

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

function normalizeNumericString(raw: unknown): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";

  // Arabic-Indic digits
  s = s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

  // Normalize separators: Arabic decimal separator "٫" -> "." and remove thousands separators
  s = s.replace(/٬|,/g, "").replace(/٫/g, ".");

  // Strip currency text and anything except digits, dot, and minus
  s = s.replace(/[^0-9.\-]/g, "");

  // If there are multiple dots, keep the first and remove the rest
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  return s;
}

function parseMoney(raw: unknown): number | null {
  const s = normalizeNumericString(raw);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // store as 2dp
  return Math.round(n * 100) / 100;
}

function parseNonNegativeInt(raw: unknown): number {
  const s = normalizeNumericString(raw);
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function pgErrorSummary(error: unknown): { code: string; msg: string } {
  const anyErr = error as { code?: unknown; message?: unknown; detail?: unknown; constraint?: unknown };
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const msgParts = [
    typeof anyErr?.message === "string" ? anyErr.message : "",
    typeof anyErr?.detail === "string" ? anyErr.detail : "",
    typeof anyErr?.constraint === "string" ? `constraint:${anyErr.constraint}` : "",
  ].filter(Boolean);
  const msg = msgParts.join(" | ").slice(0, 180);
  return { code, msg };
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

    // Safe no-op when DB user cannot run DDL.
    await ensureCatalogTablesSafe();

    const action = String(form.get("action") || "create");

    if (action === "create") {
      const slug = normalizeSlug(form.get("slug"));
      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const descriptionEn = String(form.get("description_en") || "").trim() || null;
      const descriptionAr = String(form.get("description_ar") || "").trim() || null;
      const price = parseMoney(form.get("price_jod"));
      const compareAt = parseMoney(form.get("compare_at_price_jod"));
      const inventory = parseNonNegativeInt(form.get("inventory_qty"));
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
               wear_times=excluded.wear_times,
               seasons=excluded.seasons,
               audiences=excluded.audiences,
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
          compareAt,
          inventory,
          isActive,
          wearTimes,
          seasons,
          audiences,
        ]
      );
    }

    if (action === "update") {
      const idRaw = String(form.get("id") || "").trim();
      if (!idRaw) return catalogErrorRedirect(req, form, "invalid-product-id");

      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const descriptionEn = String(form.get("description_en") || "").trim();
      const descriptionAr = String(form.get("description_ar") || "").trim();

      // Important:
      // - Inline update forms do NOT send compare_at_price_jod. We must not wipe it to NULL.
      const compareProvided = form.has("compare_at_price_jod");
      const compareAt = compareProvided ? parseMoney(form.get("compare_at_price_jod")) : null;

      const price = parseMoney(form.get("price_jod"));
      const priceSafe = price != null && price > 0 ? price : null;

      const inventory = parseNonNegativeInt(form.get("inventory_qty"));
      const categoryKey = String(form.get("category_key") || "").trim();
      const isActive = String(form.get("is_active") || "") === "on";
      const wearTimes = pickMulti(form, "wear_times");
      const seasons = pickMulti(form, "seasons");
      const audiences = pickMulti(form, "audiences");

      await db.query(
        `update products
            set name_en=coalesce(nullif($2::text,''), name_en),
                name_ar=coalesce(nullif($3::text,''), name_ar),
                description_en=coalesce(nullif($4::text,''), description_en),
                description_ar=coalesce(nullif($5::text,''), description_ar),
                price_jod=coalesce($6::numeric, price_jod),
                compare_at_price_jod=case when $7::boolean then $8::numeric else compare_at_price_jod end,
                inventory_qty=$9::int,
                category_key=coalesce(nullif($10::text,''), category_key),
                is_active=$11::boolean,
                wear_times=$12::text[],
                seasons=$13::text[],
                audiences=$14::text[],
                updated_at=now()
          where id=$1::bigint`,
        [
          idRaw,
          nameEn,
          nameAr,
          descriptionEn ? descriptionEn : null,
          descriptionAr ? descriptionAr : null,
          priceSafe,
          compareProvided,
          compareAt,
          inventory,
          categoryKey,
          isActive,
          wearTimes,
          seasons,
          audiences,
        ]
      );
    }

    if (action === "clone") {
      const idRaw = String(form.get("id") || "").trim();
      if (idRaw) {
        const source = await db.query<{
          slug: string;
          category_key: string;
          name_en: string;
          name_ar: string;
          description_en: string | null;
          description_ar: string | null;
          price_jod: string;
          compare_at_price_jod: string | null;
          wear_times: string[];
          seasons: string[];
          audiences: string[];
        }>(
          `select slug, category_key, name_en, name_ar, description_en, description_ar,
                  price_jod::text, compare_at_price_jod::text,
                  coalesce(wear_times, '{}'::text[]) as wear_times,
                  coalesce(seasons, '{}'::text[]) as seasons,
                  coalesce(audiences, '{}'::text[]) as audiences
             from products where id=$1::bigint`,
          [idRaw]
        );

        const base = source.rows[0];
        if (!base) return catalogErrorRedirect(req, form, "product-not-found");

        let nextSlug = `${base.slug}-copy`;
        let suffix = 2;
        while (true) {
          const exists = await db.query<{ id: string }>(`select id::text as id from products where slug=$1 limit 1`, [nextSlug]);
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
      const idRaw = String(form.get("id") || "").trim();
      if (idRaw) {
        await db.query(`delete from product_images where product_id=$1::bigint`, [idRaw]);
        await db.query(`delete from products where id=$1::bigint`, [idRaw]);
      }
    }

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/products] route error", error);

    // Surface the underlying PG code/message to the admin UI (short + safe).
    const { code, msg } = pgErrorSummary(error);
    const path = form
      ? catalogReturnPath(form, {
          error: "products-save-failed",
          error_code: code || "",
          error_detail: msg || "",
        })
      : `/admin/catalog?error=products-save-failed&error_code=${encodeURIComponent(code || "")}&error_detail=${encodeURIComponent(msg || "")}`;

    return NextResponse.redirect(new URL(path, req.url), 303);
  }
}
