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
  // Current kinds: AUTO, CODE. Back-compat: SEASONAL/PROMO/REFERRAL.
  promo_kind: "AUTO" | "CODE" | "SEASONAL" | "PROMO" | "REFERRAL" | string;
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
  created_at: string | null;
};

export type PromotionKindNormalized = "AUTO" | "CODE";

export type PromotionEvaluation =
  | {
      ok: true;
      promotionId: number;
      promoCode: string | null;
      promoKind: PromotionKindNormalized;
      discountJod: number;
      eligibleSubtotalJod: number;
      subtotalAfterDiscountJod: number;
      meta: {
        discountType: "PERCENT" | "FIXED";
        discountValue: number;
        titleEn: string | null;
        titleAr: string | null;
      };
      sort: {
        priority: number;
        discountJod: number;
        createdAtMs: number;
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

function parsePromoKind(value: unknown): PromotionKindNormalized {
  const kind = String(value || "").toUpperCase();
  if (kind === "AUTO" || kind === "SEASONAL") return "AUTO";
  return "CODE";
}

function createdAtMs(value: unknown): number {
  if (typeof value !== "string" || !value) return 0;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
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
    return { ok: false, code: "PROMO_NOT_STARTED", error: "Promotion is not active yet" };
  }
  if (endsAt && endsAt.getTime() < now.getTime()) {
    return { ok: false, code: "PROMO_EXPIRED", error: "Promotion has expired" };
  }

  // Usage limits: relevant for CODE promos; kept for AUTO for safety if configured.
  const usageLimit = promo.usage_limit ?? null;
  const usedCount = promo.used_count ?? 0;
  if (usageLimit != null && usedCount >= usageLimit) {
    return { ok: false, code: "PROMO_USAGE_LIMIT", error: "Promotion usage limit reached" };
  }

  const minOrder = toNum(promo.min_order_jod);
  if (minOrder > 0 && subtotalJod < minOrder) {
    return { ok: false, code: "PROMO_MIN_ORDER", error: `Minimum order is ${minOrder.toFixed(2)} JOD` };
  }

  const keys = Array.isArray(promo.category_keys)
    ? promo.category_keys.map((k) => String(k || "").trim()).filter(Boolean)
    : [];
  const slugs = Array.isArray(promo.product_slugs)
    ? promo.product_slugs.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  const hasCategoryScope = keys.length > 0;
  const hasSlugScope = slugs.length > 0;

  const eligibleLines = lines.filter((line) => {
    if (!hasCategoryScope && !hasSlugScope) return true;

    const categoryHit = hasCategoryScope && !!line.category_key && keys.includes(line.category_key);
    const slugHit = hasSlugScope && slugs.includes(line.slug);

    // OR semantics when both are present.
    return categoryHit || slugHit;
  });

  const eligibleSubtotal = round2(eligibleLines.reduce((sum, line) => sum + toNum(line.line_total_jod), 0));
  if (eligibleSubtotal <= 0) {
    return { ok: false, code: "PROMO_CATEGORY_MISMATCH", error: "Promotion does not apply to these items" };
  }

  const type = String(promo.discount_type || "").toUpperCase();
  const value = toNum(promo.discount_value);
  const isPercent = type === "PERCENT";
  const isFixed = type === "FIXED";

  if (!Number.isFinite(value) || value <= 0 || (!isPercent && !isFixed)) {
    return { ok: false, code: "PROMO_INVALID", error: "Promotion configuration is invalid" };
  }

  const rawDiscount = isPercent ? eligibleSubtotal * (value / 100) : value;
  const discountJod = round2(Math.max(0, Math.min(eligibleSubtotal, rawDiscount)));
  const subtotalAfterDiscountJod = round2(Math.max(0, subtotalJod - discountJod));

  const kind = parsePromoKind(promo.promo_kind);

  return {
    ok: true,
    promotionId: promo.id,
    promoCode: promo.code,
    promoKind: kind,
    discountJod,
    eligibleSubtotalJod: eligibleSubtotal,
    subtotalAfterDiscountJod,
    meta: {
      discountType: (isPercent ? "PERCENT" : "FIXED"),
      discountValue: value,
      titleEn: promo.title_en,
      titleAr: promo.title_ar,
    },
    sort: {
      priority: typeof promo.priority === "number" && Number.isFinite(promo.priority) ? promo.priority : 0,
      discountJod,
      createdAtMs: createdAtMs(promo.created_at),
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
            usage_limit, used_count, is_active,
            category_keys, product_slugs, min_order_jod, priority,
            created_at::text as created_at
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
  // Short-circuit: empty cart
  if (!lines.length || !(subtotalJod > 0)) {
    return { ok: false, code: "PROMO_NOT_FOUND", error: "No eligible items" };
  }

  const cats = Array.from(
    new Set(lines.map((l) => String(l.category_key || "").trim()).filter(Boolean))
  );
  const slugs = Array.from(new Set(lines.map((l) => String(l.slug || "").trim()).filter(Boolean)));

  // Pull candidate AUTO promos (back-compat includes SEASONAL).
  // Filter by overlap to reduce rows, but keep null scopes (apply-to-all).
  const promoRes = await dbx.query<PromotionRow>(
    `select id, promo_kind, code, title_en, title_ar, discount_type, discount_value,
            starts_at::text, ends_at::text,
            usage_limit, used_count, is_active,
            category_keys, product_slugs, min_order_jod, priority,
            created_at::text as created_at
       from promotions
      where promo_kind in ('AUTO','SEASONAL')
        and is_active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and (
          category_keys is null
          or product_slugs is null
          or array_length(category_keys, 1) is null
          or array_length(product_slugs, 1) is null
          or category_keys && $1::text[]
          or product_slugs && $2::text[]
        )
      order by priority desc, created_at desc
      limit 80`,
    [cats, slugs]
  );

  const candidates = promoRes.rows || [];
  if (!candidates.length) {
    return { ok: false, code: "PROMO_NOT_FOUND", error: "No active AUTO promotions" };
  }

  let best: PromotionEvaluation | null = null;

  for (const promo of candidates) {
    const evaluated = evaluatePromotionRow(promo, lines, subtotalJod, now);
    if (!evaluated.ok) continue;
    if (evaluated.discountJod <= 0) continue;

    if (!best || !best.ok) {
      best = evaluated;
      continue;
    }

    const a = evaluated.sort;
    const b = best.sort;

    if (a.priority !== b.priority) {
      if (a.priority > b.priority) best = evaluated;
      continue;
    }

    if (a.discountJod !== b.discountJod) {
      if (a.discountJod > b.discountJod) best = evaluated;
      continue;
    }

    if (a.createdAtMs !== b.createdAtMs) {
      if (a.createdAtMs > b.createdAtMs) best = evaluated;
      continue;
    }
  }

  return best || { ok: false, code: "PROMO_NOT_FOUND", error: "No eligible AUTO promotion" };
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
