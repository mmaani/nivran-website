export type CartItem = {
  slug: string;
  variantId?: number | null;
  variantLabel?: string;
  name: string;
  priceJod: number;
  qty: number;
};

export const CART_KEY = "nivran_cart_v1";
export const CART_LOCAL_KEY = CART_KEY;
export const MAX_QTY = 99;

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Keep variantId NULL when absent/invalid.
 * Never coerce null/undefined/"" to 0 (Number(null) === 0).
 */
function normalizeVariantId(v: unknown): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0 ? Math.trunc(v) : null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  return null;
}

export function clampQty(v: unknown, min = 1, max = MAX_QTY): number {
  const x = Math.floor(toNum(v) || min);
  return Math.min(max, Math.max(min, x));
}

export function normalizeCartItems(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  const out: CartItem[] = [];

  for (const it of items) {
    if (!isRecord(it)) continue;

    const slug = toStr(it.slug).trim();
    if (!slug) continue;

    out.push({
      slug,
      variantId: normalizeVariantId(it.variantId),
      variantLabel: toStr(it.variantLabel).trim(),
      name: toStr(it.name).trim(),
      priceJod: toNum(it.priceJod),
      qty: clampQty(it.qty),
    });
  }

  // de-dupe by slug + variant
  const map = new Map<string, CartItem>();
  for (const i of out) map.set(`${i.slug}::${i.variantId ?? "base"}`, i);
  return Array.from(map.values());
}

/** Client helpers (safe; guarded for SSR) */
export function readLocalCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return normalizeCartItems(parsed);
  } catch {
    return [];
  }
}

export function writeLocalCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(items)));
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {}
}

export function clearLocalCart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {}
}

export function cartQty(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + clampQty(i.qty), 0);
}

export function cartSubtotalJod(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + Number(i.priceJod || 0) * clampQty(i.qty), 0);
}

/** Pure merge helper (safe in client/server) */
export function mergeCartSum(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();

  for (const it of normalizeCartItems(a)) map.set(`${it.slug}::${it.variantId ?? "base"}`, { ...it });

  for (const it of normalizeCartItems(b)) {
    const key = `${it.slug}::${it.variantId ?? "base"}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...it });
      continue;
    }
    map.set(key, {
      slug: it.slug,
      variantId: it.variantId ?? prev.variantId ?? null,
      variantLabel: it.variantLabel || prev.variantLabel,
      name: it.name || prev.name,
      priceJod: Number.isFinite(it.priceJod) ? it.priceJod : prev.priceJod,
      qty: clampQty((prev.qty || 0) + (it.qty || 0)),
    });
  }

  return Array.from(map.values());
}
