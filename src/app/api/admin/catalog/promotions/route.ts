import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PromoKind = "AUTO" | "CODE";

function normalizePromoKind(value: unknown): PromoKind {
  const kind = String(value || "").trim().toUpperCase();
  // Back-compat: older UI/data used SEASONAL/PROMO/REFERRAL.
  if (kind === "AUTO" || kind === "SEASONAL") return "AUTO";
  return "CODE";
}

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

function normalizeDigits(value: string): string {
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return value.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function parseLocaleNumber(input: unknown): number | null {
  const raw = normalizeDigits(String(input ?? "").trim());
  if (!raw) return null;
  let s = raw.replace(/٬/g, "").replace(/٫/g, ".");
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
      const promoKind = normalizePromoKind(form.get("promo_kind"));
      const codeRaw = String(form.get("code") || "").trim().toUpperCase();
      const code = promoKind === "CODE" ? (codeRaw || null) : null;
      const titleEn = String(form.get("title_en") || "").trim();
      const titleAr = String(form.get("title_ar") || "").trim();
      const discountType = String(form.get("discount_type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
      const discountValue = parseLocaleNumber(form.get("discount_value"));
      const startsAt = String(form.get("starts_at") || "").trim() || null;
      const endsAt = String(form.get("ends_at") || "").trim() || null;

      const usageLimitRaw = String(form.get("usage_limit") || "").trim();
      const usageLimit = usageLimitRaw ? parseLocaleNumber(usageLimitRaw) : null;

      const minOrderRaw = String(form.get("min_order_jod") || "").trim();
      const minOrderJod = minOrderRaw ? parseLocaleNumber(minOrderRaw) : null;

      const priorityRaw = parseLocaleNumber(form.get("priority"));
      const priority = priorityRaw == null ? 0 : Math.trunc(priorityRaw);
      const productSlugsRaw = String(form.get("product_slugs") || "").trim();
      const productSlugs = readProductSlugs(productSlugsRaw);

      const isActive = String(form.get("is_active") || "") === "on";
      const categoryKeys = readCategoryKeys(form);

      if (!titleEn || !titleAr || discountValue == null || discountValue <= 0) {
        return catalogErrorRedirect(req, form, "invalid-promo");
      }

      if (promoKind === "CODE" && !code) {
        return catalogErrorRedirect(req, form, "missing-code");
      }

      if (minOrderRaw && (minOrderJod == null || Number(minOrderJod) < 0)) {
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
        [promoKind, code, titleEn, titleAr, discountType, discountValue, startsAt, endsAt, usageLimit == null ? null : Math.trunc(usageLimit), minOrderJod, priority, productSlugs, isActive, categoryKeys]
      );
    }

    if (action === "update") {
      const id = Number(form.get("id") || 0);
      if (!(id > 0)) return catalogErrorRedirect(req, form, "invalid-promo-id");

      const promoKind = normalizePromoKind(form.get("promo_kind"));
      const codeRaw = String(form.get("code") || "").trim().toUpperCase();
      const code = promoKind === "CODE" ? (codeRaw || null) : null;

      const titleEn = String(form.get("title_en") || "").trim();
      const titleAr = String(form.get("title_ar") || "").trim();
      const discountType = String(form.get("discount_type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
      const discountValue = parseLocaleNumber(form.get("discount_value"));
      const startsAt = String(form.get("starts_at") || "").trim() || null;
      const endsAt = String(form.get("ends_at") || "").trim() || null;

      const usageLimitRaw = String(form.get("usage_limit") || "").trim();
      const usageLimit = usageLimitRaw ? parseLocaleNumber(usageLimitRaw) : null;

      const minOrderRaw = String(form.get("min_order_jod") || "").trim();
      const minOrderJod = minOrderRaw ? parseLocaleNumber(minOrderRaw) : null;

      const priorityRaw = parseLocaleNumber(form.get("priority"));
      const priority = priorityRaw == null ? 0 : Math.trunc(priorityRaw);

      const productSlugsRaw = String(form.get("product_slugs") || "").trim();
      const productSlugs = readProductSlugs(productSlugsRaw);
      const isActive = String(form.get("is_active") || "") === "on";
      const categoryKeys = readCategoryKeys(form);

      if (!titleEn || !titleAr || discountValue == null || discountValue <= 0) {
        return catalogErrorRedirect(req, form, "invalid-promo");
      }
      if (promoKind === "CODE" && !code) {
        return catalogErrorRedirect(req, form, "missing-code");
      }
      if (minOrderRaw && (minOrderJod == null || Number(minOrderJod) < 0)) {
        return catalogErrorRedirect(req, form, "invalid-min-order");
      }

      await db.query(
        `update promotions
            set promo_kind=$2,
                code=$3,
                title_en=$4,
                title_ar=$5,
                discount_type=$6,
                discount_value=$7,
                starts_at=$8,
                ends_at=$9,
                usage_limit=$10,
                min_order_jod=$11,
                priority=$12,
                product_slugs=$13,
                is_active=$14,
                category_keys=$15,
                updated_at=now()
          where id=$1`,
        [
          id,
          promoKind,
          code,
          titleEn,
          titleAr,
          discountType,
          discountValue,
          startsAt,
          endsAt,
          usageLimit == null ? null : Math.trunc(usageLimit),
          minOrderJod,
          priority,
          productSlugs,
          isActive,
          categoryKeys,
        ]
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
