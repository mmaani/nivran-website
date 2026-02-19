import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCategoryKeys(form: FormData): string[] | null {
  const raw = form.getAll("category_keys").map((v) => String(v || "").trim()).filter(Boolean);
  if (!raw.length || raw.includes("__ALL__")) return null;
  return Array.from(new Set(raw));
}

function readProductSlugs(raw: string): string[] | null {
  const values = raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (!values.length) return null;
  return Array.from(new Set(values));
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
      const rawKind = String(form.get("promo_kind") || "PROMO").trim().toUpperCase();
      const promoKind = rawKind === "SEASONAL" || rawKind === "REFERRAL" ? rawKind : "PROMO";
      const codeRaw = String(form.get("code") || "").trim().toUpperCase();
      const code = codeRaw || null;
      const titleEn = String(form.get("title_en") || "").trim();
      const titleAr = String(form.get("title_ar") || "").trim();
      const discountType = String(form.get("discount_type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
      const discountValue = Number(form.get("discount_value") || 0);
      const startsAt = String(form.get("starts_at") || "").trim() || null;
      const endsAt = String(form.get("ends_at") || "").trim() || null;

      const usageLimitRaw = String(form.get("usage_limit") || "").trim();
      const usageLimit = usageLimitRaw ? Number(usageLimitRaw) : null;

      const minOrderRaw = String(form.get("min_order_jod") || "").trim();
      const minOrderJod = minOrderRaw ? Number(minOrderRaw) : null;

      const priority = Number(form.get("priority") || 0);
      const productSlugsRaw = String(form.get("product_slugs") || "").trim();
      const productSlugs = readProductSlugs(productSlugsRaw);

      const isActive = String(form.get("is_active") || "") === "on";
      const categoryKeys = readCategoryKeys(form);

      if (!titleEn || !titleAr || !Number.isFinite(discountValue) || discountValue <= 0) {
        return catalogErrorRedirect(req, form, "invalid-promo");
      }

      if (!code) {
        return catalogErrorRedirect(req, form, "missing-code");
      }

      if (minOrderRaw && (!Number.isFinite(minOrderJod) || Number(minOrderJod) < 0)) {
        return catalogErrorRedirect(req, form, "invalid-min-order");
      }

      await db.query(
        `insert into promotions
          (promo_kind, code, title_en, title_ar, discount_type, discount_value, starts_at, ends_at, usage_limit, min_order_jod, priority, product_slugs, is_active, category_keys)
         values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (code)
         do update
           set promo_kind=excluded.promo_kind,
               title_en=excluded.title_en,
               title_ar=excluded.title_ar,
               discount_type=excluded.discount_type,
               discount_value=excluded.discount_value,
               starts_at=excluded.starts_at,
               ends_at=excluded.ends_at,
               usage_limit=excluded.usage_limit,
               min_order_jod=excluded.min_order_jod,
               priority=excluded.priority,
               product_slugs=excluded.product_slugs,
               is_active=excluded.is_active,
               category_keys=excluded.category_keys,
               updated_at=now()`,
        [promoKind, code, titleEn, titleAr, discountType, discountValue, startsAt, endsAt, usageLimit, minOrderJod, Number.isFinite(priority) ? Math.trunc(priority) : 0, productSlugs, isActive, categoryKeys]
      );
    }

    if (action === "toggle") {
      const id = Number(form.get("id") || 0);
      const isActive = String(form.get("is_active") || "") === "on";
      if (id > 0) {
        await db.query(`update promotions set is_active=$2, updated_at=now() where id=$1`, [id, isActive]);
      }
    }

    if (action === "delete") {
      const id = Number(form.get("id") || 0);
      if (id > 0) {
        await db.query(`delete from promotions where id=$1`, [id]);
      }
    }

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/promotions] route error", error);
    return catalogErrorRedirect(req, form, "promo-save-failed");
  }
}
