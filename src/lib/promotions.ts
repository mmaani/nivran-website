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
  promo_kind: string;
  code: string | null;
  title_en: string | null;
  title_ar: string | null;
  discount_type: string;
  discount_value: string | number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number | null;
  is_active: boolean;
  category_keys: unknown;
  product_slugs: unknown;
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
        priority: number;
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

function normalizeTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x ?? "").trim())
      .map((x) => x.replace(/^"|"$/g, ""))
      .filter((x) => x.length > 0);
  }

  if (typeof value === "string") {
    const raw = value.trim();
    // Handles Postgres array text format: {a,b} or {"a","b"}
    const inner = raw.startsWith("{") && raw.endsWith("}") ? raw.slice(1, -1) : raw;
    if (!inner) return [];
    return inner
      .split(",")
      .map((x) => x.trim())
      .map((x) => x.replace(/^"|"$/g, ""))
      .filter((x) => x.length > 0);
  }

  return [];
}

function parsePromoKind(value: unknown): "AUTO" | "CODE" {
  const kind = String(value ?? "").trim().toUpperCase();
  if (kind === "AUTO" || kind === "SEASONAL") return "AUTO";
  return "CODE";
}

function evaluatePromotionRow(
  promo: PromotionRow,
  lines: PricedOrderLine[],
  subtotalJod: number,
  now: Date
): PromotionEvaluation {
  if (!promo.is_active) return { ok: false, code: "PROMO_INACTIVE", error: "Promotion is inactive" };

  const startsAt = promo.starts_at ? new Date(promo.starts_at) : null;
  const endsAt = promo.ends_at ? new Date(promo.ends_at) : null;

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return { ok: false, code: "PROMO_NOT_STARTED", error: "Promotion has not started yet" };
  }
  if (endsAt && endsAt.getTime() < now.getTime()) {
    return { ok: false, code: "PROMO_EXPIRED", error: "Promotion has expired" };
  }

  const usageLimit = promo.usage_limit ?? null;
  const usedCount = promo.used_count ?? 0;
  if (usageLimit != null && usedCount >= usageLimit) {
    return { ok: false, code: "PROMO_USAGE_LIMIT", error: "Promotion usage limit reached" };
  }

  const minOrder = toNum(promo.min_order_jod);
  if (minOrder > 0 && subtotalJod < minOrder) {
    return { ok: false, code: "PROMO_MIN_ORDER", error: "Minimum order not met" };
  }

  const categoryKeys = normalizeTextArray(promo.category_keys);
  const productSlugs = normalizeTextArray(promo.product_slugs);

  const hasCategoryScope = categoryKeys.length > 0;
  const hasSlugScope = productSlugs.length > 0;

  // Scope rules (more forgiving):
  // - If only categories provided => category match.
  // - If only slugs provided => slug match.
  // - If BOTH provided => category OR slug match.
  // - If none provided => all lines eligible.
  const eligibleLines = lines.filter((line) => {
    if (!hasCategoryScope && !hasSlugScope) return true;

    const categoryOk = !hasCategoryScope || (line.category_key ? categoryKeys.includes(line.category_key) : false);
    const slugOk = !hasSlugScope || productSlugs.includes(line.slug);

    if (hasCategoryScope && hasSlugScope) return categoryOk || slugOk;
    if (hasCategoryScope) return categoryOk;
    return slugOk;
  });

  const eligibleSubtotal = round2(eligibleLines.reduce((sum, line) => sum + toNum(line.line_total_jod), 0));
  if (eligibleSubtotal <= 0) {
    return { ok: false, code: "PROMO_CATEGORY_MISMATCH", error: "Promotion does not apply to these items" };
  }

  const type = String(promo.discount_type ?? "").trim().toUpperCase();
  const value = toNum(promo.discount_value);

  if (!Number.isFinite(value) || value <= 0 || (type !== "PERCENT" && type !== "FIXED")) {
    return { ok: false, code: "PROMO_INVALID", error: "Promotion configuration is invalid" };
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
      priority: typeof promo.priority === "number" && Number.isFinite(promo.priority) ? promo.priority : 0,
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
  const promoCode = String(promoCodeRaw ?? "").trim().toUpperCase();
  if (!promoCode) return { ok: false, code: "PROMO_INVALID", error: "Promo code is required" };

  const promoRes = await dbx.query<PromotionRow>(
    `select id,
            promo_kind,
            code,
            title_en,
            title_ar,
            discount_type,
            discount_value,
            starts_at::text,
            ends_at::text,
            usage_limit,
            used_count,
            is_active,
            category_keys,
            product_slugs,
            min_order_jod,
            priority
       from promotions
      where code = $1
        and promo_kind in ('CODE','PROMO','REFERRAL')
      limit 1`,
    [promoCode]
  );

  const promo = promoRes.rows[0];
  if (!promo) return { ok: false, code: "PROMO_NOT_FOUND", error: "Promo code not found" };
  return evaluatePromotionRow(promo, lines, subtotalJod, now);
}

export async function evaluateAutoPromotionForLines(
  dbx: DbExecutor,
  lines: PricedOrderLine[],
  subtotalJod: number,
  now = new Date()
): Promise<PromotionEvaluation> {
  const promoRes = await dbx.query<PromotionRow>(
    `select id,
            promo_kind,
            code,
            title_en,
            title_ar,
            discount_type,
            discount_value,
            starts_at::text,
            ends_at::text,
            usage_limit,
            used_count,
            is_active,
            category_keys,
            product_slugs,
            min_order_jod,
            priority
       from promotions
      where promo_kind in ('AUTO','SEASONAL')
        and is_active = true
      order by priority desc, created_at desc, id desc
      limit 30`,
    []
  );

  const promos = promoRes.rows || [];
  if (!promos.length) {
    return { ok: false, code: "PROMO_NOT_FOUND", error: "No active seasonal promotion" };
  }

  let bestOk: Extract<PromotionEvaluation, { ok: true }> | null = null;

  for (const p of promos) {
    const evaluated = evaluatePromotionRow(p, lines, subtotalJod, now);
    if (!evaluated.ok) continue;

    if (!bestOk) {
      bestOk = evaluated;
      continue;
    }

    const a = evaluated.meta.priority;
    const b = bestOk.meta.priority;

    if (a > b) {
      bestOk = evaluated;
      continue;
    }
    if (a < b) continue;

    if (evaluated.discountJod > bestOk.discountJod) {
      bestOk = evaluated;
      continue;
    }
    if (evaluated.discountJod < bestOk.discountJod) continue;

    if (evaluated.promotionId > bestOk.promotionId) {
      bestOk = evaluated;
    }
  }

  return bestOk
    ? bestOk
    : { ok: false, code: "PROMO_CATEGORY_MISMATCH", error: "No eligible seasonal promotion" };
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
