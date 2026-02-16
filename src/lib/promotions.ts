import "server-only";
import type { DbExecutor } from "@/lib/db";

export type PricedOrderLine = {
  slug: string;
  qty: number;
  category_key: string | null;
  line_total_jod: number;
};

type PromotionRow = {
  id: number;
  code: string;
  title_en: string | null;
  title_ar: string | null;
  discount_type: "PERCENT" | "FIXED" | string;
  discount_value: string | number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number | null;
  is_active: boolean;
  category_keys: string[] | null;
  min_order_jod: string | number | null;
};

export type PromotionEvaluation =
  | {
      ok: true;
      promotionId: number;
      promoCode: string;
      discountJod: number;
      eligibleSubtotalJod: number;
      subtotalAfterDiscountJod: number;
      meta: {
        discountType: string;
        discountValue: number;
        titleEn: string | null;
        titleAr: string | null;
      };
    }
  | {
      ok: false;
      error: string;
      code:
        | "PROMO_NOT_FOUND"
        | "PROMO_INACTIVE"
        | "PROMO_NOT_STARTED"
        | "PROMO_EXPIRED"
        | "PROMO_USAGE_LIMIT"
        | "PROMO_CATEGORY_MISMATCH"
        | "PROMO_MIN_ORDER"
        | "PROMO_INVALID";
    };

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function evaluatePromoCodeForLines(
  dbx: DbExecutor,
  promoCodeRaw: string,
  lines: PricedOrderLine[],
  subtotalJod: number,
  now = new Date()
): Promise<PromotionEvaluation> {
  const promoCode = String(promoCodeRaw || "").trim().toUpperCase();
  if (!promoCode) return { ok: false, code: "PROMO_INVALID", error: "Promo code is required" };

  const promoRes = await dbx.query<PromotionRow>(
    `select id, code, title_en, title_ar, discount_type, discount_value,
            starts_at::text, ends_at::text,
            usage_limit, used_count, is_active, category_keys, min_order_jod
       from promotions
      where code = $1
      limit 1`,
    [promoCode]
  );

  const promo = promoRes.rows[0];
  if (!promo) return { ok: false, code: "PROMO_NOT_FOUND", error: "Promo code not found" };
  if (!promo.is_active) return { ok: false, code: "PROMO_INACTIVE", error: "Promo code is inactive" };

  const startsAt = promo.starts_at ? new Date(promo.starts_at) : null;
  const endsAt = promo.ends_at ? new Date(promo.ends_at) : null;

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return { ok: false, code: "PROMO_NOT_STARTED", error: "Promo code is not active yet" };
  }
  if (endsAt && endsAt.getTime() < now.getTime()) {
    return { ok: false, code: "PROMO_EXPIRED", error: "Promo code has expired" };
  }

  const usageLimit = promo.usage_limit ?? null;
  const usedCount = promo.used_count ?? 0;
  if (usageLimit != null && usedCount >= usageLimit) {
    return { ok: false, code: "PROMO_USAGE_LIMIT", error: "Promo code usage limit reached" };
  }

  const minOrder = toNum(promo.min_order_jod);
  if (minOrder > 0 && subtotalJod < minOrder) {
    return { ok: false, code: "PROMO_MIN_ORDER", error: `Minimum order is ${minOrder.toFixed(2)} JOD` };
  }

  const keys = Array.isArray(promo.category_keys)
    ? promo.category_keys.map((k) => String(k || "").trim()).filter(Boolean)
    : [];
  const hasScopedCategories = keys.length > 0;

  const eligibleSubtotal = hasScopedCategories
    ? round2(lines.filter((line) => line.category_key && keys.includes(line.category_key)).reduce((sum, line) => sum + toNum(line.line_total_jod), 0))
    : round2(subtotalJod);

  if (eligibleSubtotal <= 0) {
    return { ok: false, code: "PROMO_CATEGORY_MISMATCH", error: "Promo code does not apply to these items" };
  }

  const type = String(promo.discount_type || "").toUpperCase();
  const value = toNum(promo.discount_value);
  if (!Number.isFinite(value) || value <= 0 || (type !== "PERCENT" && type !== "FIXED")) {
    return { ok: false, code: "PROMO_INVALID", error: "Promo configuration is invalid" };
  }

  const rawDiscount = type === "PERCENT" ? eligibleSubtotal * (value / 100) : value;
  const discountJod = round2(Math.max(0, Math.min(eligibleSubtotal, rawDiscount)));
  const subtotalAfterDiscountJod = round2(Math.max(0, subtotalJod - discountJod));

  return {
    ok: true,
    promotionId: promo.id,
    promoCode,
    discountJod,
    eligibleSubtotalJod: eligibleSubtotal,
    subtotalAfterDiscountJod,
    meta: {
      discountType: type,
      discountValue: value,
      titleEn: promo.title_en,
      titleAr: promo.title_ar,
    },
  };
}

export async function consumePromotionUsage(dbx: DbExecutor, promotionId: number): Promise<boolean> {
  const r = await dbx.query<{ id: number }>(
    `update promotions
        set used_count = coalesce(used_count, 0) + 1,
            updated_at = now()
      where id = $1
        and (usage_limit is null or coalesce(used_count, 0) < usage_limit)
      returning id`,
    [promotionId]
  );

  return (r.rowCount ?? 0) > 0;
}
