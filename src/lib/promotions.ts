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
  promo_kind: "AUTO" | "CODE" | string;
  code: string | null;
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
  product_slugs: string[] | null;
  min_order_jod: string | number | null;
  priority: number | null;
};

export type PromotionEvaluation =
  | {
      ok: true;
      promotionId: number;
      promoCode: string | null;
      promoKind: "AUTO" | "CODE";
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

function parsePromoKind(value: unknown): "AUTO" | "CODE" {
  return String(value || "").toUpperCase() === "AUTO" ? "AUTO" : "CODE";
}

function evaluatePromotionRow(
  promo: PromotionRow,
  lines: PricedOrderLine[],
  subtotalJod: number,
  now: Date
): PromotionEvaluation {
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

  const targetSlugs = Array.isArray(promo.product_slugs)
    ? promo.product_slugs.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const hasScopedSlugs = targetSlugs.length > 0;

  const eligibleSubtotal = round2(
    lines
      .filter((line) => {
        const categoryOk = !hasScopedCategories || (line.category_key ? keys.includes(line.category_key) : false);
        const slugOk = !hasScopedSlugs || targetSlugs.includes(line.slug);
        return categoryOk && slugOk;
      })
      .reduce((sum, line) => sum + toNum(line.line_total_jod), 0)
  );

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
    promoCode: promo.code,
    promoKind: parsePromoKind(promo.promo_kind),
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
    `select id, promo_kind, code, title_en, title_ar, discount_type, discount_value,
            starts_at::text, ends_at::text,
            usage_limit, used_count, is_active, category_keys, product_slugs, min_order_jod, priority
       from promotions
      where code = $1 and promo_kind='CODE'
      limit 1`,
    [promoCode]
  );

  const promo = promoRes.rows[0];
  if (!promo) return { ok: false, code: "PROMO_NOT_FOUND", error: "Promo code not found" };
  return evaluatePromotionRow(promo, lines, subtotalJod, now);
}

export async function evaluateAutomaticPromotionForLines(
  dbx: DbExecutor,
  lines: PricedOrderLine[],
  subtotalJod: number,
  now = new Date()
): Promise<PromotionEvaluation> {
  const promoRes = await dbx.query<PromotionRow>(
    `select id, promo_kind, code, title_en, title_ar, discount_type, discount_value,
            starts_at::text, ends_at::text,
            usage_limit, used_count, is_active, category_keys, product_slugs, min_order_jod, priority
       from promotions
      where promo_kind='AUTO' and is_active=true
      order by priority desc, created_at desc
      limit 200`
  );

  let best: PromotionEvaluation | null = null;

  for (const promo of promoRes.rows) {
    const evaluated = evaluatePromotionRow(promo, lines, subtotalJod, now);
    if (!evaluated.ok) continue;
    if (!best || (evaluated.ok && evaluated.discountJod > best.discountJod)) {
      best = evaluated;
    }
  }

  if (!best) return { ok: false, code: "PROMO_NOT_FOUND", error: "No automatic promotion applies" };
  return best;
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
