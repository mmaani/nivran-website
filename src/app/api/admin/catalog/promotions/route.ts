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

function normalizePromoKind(value: unknown): "AUTO" | "CODE" {
  const kind = String(value || "").trim().toUpperCase();
  if (kind === "AUTO" || kind === "SEASONAL") return "AUTO";
  return "CODE"; // CODE / PROMO / REFERRAL
}

function normalizeNumericString(raw: unknown): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";

  s = s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

  s = s.replace(/٬|,/g, "").replace(/٫/g, ".");
  s = s.replace(/[^0-9.\-]/g, "");

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
  return Math.round(n * 100) / 100;
}

function parseIntOrNull(raw: unknown): number | null {
  const s = normalizeNumericString(raw);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeDatetimeLocalToTimestamptz(value: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;

  // If already has timezone info, keep it as-is.
  if (/[zZ]$/.test(v) || /[+-]\d{2}:?\d{2}$/.test(v)) return v;

  // datetime-local usually: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00+03:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return `${v}+03:00`;

  return v;
}

function readCategoryKeys(form: FormData): string[] | null {
  const raw = form
    .getAll("category_keys")
    .map((v) => String(v || "").trim())
    .filter(Boolean);
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

    await ensureCatalogTablesSafe();
    const action = String(form.get("action") || "create");

    if (action === "create" || action === "update") {
      const idRaw = String(form.get("id") || "").trim();
      const promoKind = normalizePromoKind(form.get("promo_kind"));
      const codeRaw = String(form.get("code") || "").trim().toUpperCase();
      const code = promoKind === "AUTO" ? null : (codeRaw || null);

      const titleEn = String(form.get("title_en") || "").trim();
      const titleAr = String(form.get("title_ar") || "").trim();
      const discountType = String(form.get("discount_type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
      const discountValue = parseMoney(form.get("discount_value"));
      const startsAt = normalizeDatetimeLocalToTimestamptz(String(form.get("starts_at") || ""));
      const endsAt = normalizeDatetimeLocalToTimestamptz(String(form.get("ends_at") || ""));
      const usageLimit = parseIntOrNull(form.get("usage_limit"));
      const minOrderJod = parseMoney(form.get("min_order_jod"));
      const priority = parseIntOrNull(form.get("priority")) ?? 0;
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

      // Create: upsert by code when CODE promos to avoid accidental duplicates.
      // Update: update by id.
      if (action === "create") {
        const r = await db.query<{ id: string }>(
          `insert into promotions
            (promo_kind, code, title_en, title_ar, discount_type, discount_value, starts_at, ends_at, usage_limit, min_order_jod, priority, product_slugs, is_active, category_keys)
           values
            ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::int,$10::numeric,$11::int,$12::text[],$13::boolean,$14::text[])
           on conflict (code) do update
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
                 updated_at=now()
           returning id::text as id`,
          [
            promoKind,
            code,
            titleEn,
            titleAr,
            discountType,
            discountValue,
            startsAt,
            endsAt,
            usageLimit,
            minOrderJod,
            priority,
            productSlugs,
            isActive,
            categoryKeys,
          ]
        );

        const newId = r.rows?.[0]?.id;
        return catalogSavedRedirect(req, form, newId ? { promoEditId: newId } : undefined);
      }

      if (!idRaw) return catalogErrorRedirect(req, form, "invalid-promo-id");

      const u = await db.query<{ id: string }>(
        `update promotions
            set promo_kind=$2,
                code=$3,
                title_en=$4,
                title_ar=$5,
                discount_type=$6,
                discount_value=$7::numeric,
                starts_at=$8::timestamptz,
                ends_at=$9::timestamptz,
                usage_limit=$10::int,
                min_order_jod=$11::numeric,
                priority=$12::int,
                product_slugs=$13::text[],
                is_active=$14::boolean,
                category_keys=$15::text[],
                updated_at=now()
          where id=$1::bigint
          returning id::text as id`,
        [
          idRaw,
          promoKind,
          code,
          titleEn,
          titleAr,
          discountType,
          discountValue,
          startsAt,
          endsAt,
          usageLimit,
          minOrderJod,
          priority,
          productSlugs,
          isActive,
          categoryKeys,
        ]
      );

      const updatedId = u.rows?.[0]?.id;
      if (!updatedId) return catalogErrorRedirect(req, form, "promo-not-found");
      return catalogSavedRedirect(req, form, { promoEditId: updatedId });
    }

    if (action === "toggle") {
      const idRaw = String(form.get("id") || "").trim();
      const isActive = String(form.get("is_active") || "") === "on";
      if (idRaw) {
        await db.query(`update promotions set is_active=$2, updated_at=now() where id=$1::bigint`, [idRaw, isActive]);
      }
      return catalogSavedRedirect(req, form, idRaw ? { promoEditId: idRaw } : undefined);
    }

    if (action === "delete") {
      const idRaw = String(form.get("id") || "").trim();
      if (idRaw) {
        await db.query(`delete from promotions where id=$1::bigint`, [idRaw]);
      }
      return catalogSavedRedirect(req, form);
    }

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/promotions] route error", error);

    const { code, msg } = pgErrorSummary(error);
    const path = form
      ? catalogReturnPath(form, { error: "promo-save-failed", error_code: code || "", error_detail: msg || "" })
      : `/admin/catalog?error=promo-save-failed&error_code=${encodeURIComponent(code || "")}&error_detail=${encodeURIComponent(msg || "")}`;

    return NextResponse.redirect(new URL(path, req.url), 303);
  }
}
