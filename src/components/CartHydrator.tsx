"use client";

import { useEffect } from "react";

const KEY = "nivran_cart_v1";
const KEY_CUS = "nivran_customer_id_v1";
const REORDER_KEY = "nivran_reorder_payload_v1";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
  variantId?: number | null;
  variantLabel?: string | null;

  // tolerate legacy server payloads
  variant_id?: number | null;
};

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getField(obj: JsonRecord, key: string): unknown {
  return obj[key];
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Preserve NULL for missing/invalid variant IDs. Only accept positive integers. */
function normVariantId(v: unknown): number | null {
  const n = toNum(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/** ✅ consistent key: base is "base", and variantId <= 0 is treated as base */
function keyOf(slug: string, variantId: number | null): string {
  const v = typeof variantId === "number" && Number.isFinite(variantId) && variantId > 0 ? Math.trunc(variantId) : null;
  return `${slug}::${v ?? "base"}`;
}

function clampQty(v: unknown): number {
  const n = toNum(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}

function parseCartItems(v: unknown): CartItem[] {
  if (!Array.isArray(v)) return [];
  const out: CartItem[] = [];

  for (const it of v) {
    if (!isRecord(it)) continue;

    const slug = toStr(getField(it, "slug")).trim();
    if (!slug) continue;

    const name = toStr(getField(it, "name")).trim() || slug;
    const priceJod = toNum(getField(it, "priceJod"));
    const qty = clampQty(getField(it, "qty"));

    const variantRaw = getField(it, "variantId") ?? getField(it, "variant_id");
    const variantId = normVariantId(variantRaw);

    const variantLabelRaw = getField(it, "variantLabel");
    const variantLabel = typeof variantLabelRaw === "string" ? variantLabelRaw : null;

    out.push({ slug, name, priceJod, qty, variantId, variantLabel });
  }

  return out;
}

function collapse(items: CartItem[]): CartItem[] {
  const m = new Map<string, CartItem>();

  for (const it of items) {
    const slug = toStr(it.slug).trim();
    if (!slug) continue;

    const variantId = normVariantId(it.variantId ?? it.variant_id);
    const k = keyOf(slug, variantId);

    const prev = m.get(k);
    if (!prev) {
      m.set(k, {
        slug,
        name: toStr(it.name).trim() || slug,
        priceJod: toNum(it.priceJod),
        qty: clampQty(it.qty),
        variantId,
        variantLabel: typeof it.variantLabel === "string" ? it.variantLabel : null,
      });
      continue;
    }

    m.set(k, {
      ...prev,
      qty: clampQty((prev.qty || 0) + (it.qty || 0)),
    });
  }

  return Array.from(m.values());
}

function readLocal(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return collapse(parseCartItems(parsed));
  } catch {
    return [];
  }
}

function writeLocal(items: CartItem[], customerId?: number) {
  localStorage.setItem(KEY, JSON.stringify(collapse(items)));
  if (customerId) localStorage.setItem(KEY_CUS, String(customerId));
  window.dispatchEvent(new Event("nivran_cart_updated"));
}

function readLocalCustomerId(): number | null {
  try {
    const raw = localStorage.getItem(KEY_CUS);
    const n = Number(raw || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function getBool(obj: JsonRecord, key: string): boolean {
  return obj[key] === true;
}

function hasPendingReorderPayload(): boolean {
  try {
    const byQuery = typeof window !== "undefined" && new URL(window.location.href).searchParams.get("reorder") === "1";
    if (byQuery) return true;

    const raw = sessionStorage.getItem(REORDER_KEY);
    if (!raw) return false;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return false;

    const items = getField(parsed, "items");
    return Array.isArray(items) && items.length > 0;
  } catch {
    return false;
  }
}

/**
 * ✅ Key fix for duplication:
 * Only call server "merge" when local cart is meaningfully different from server cart.
 */
function sameCart(a: CartItem[], b: CartItem[]): boolean {
  const aa = collapse(a);
  const bb = collapse(b);

  if (aa.length !== bb.length) return false;

  const mapA = new Map<string, number>();
  for (const it of aa) {
    mapA.set(keyOf(it.slug, normVariantId(it.variantId)), clampQty(it.qty));
  }

  for (const it of bb) {
    const k = keyOf(it.slug, normVariantId(it.variantId));
    const q = clampQty(it.qty);
    if ((mapA.get(k) ?? -1) !== q) return false;
  }

  return true;
}

export default function CartHydrator() {
  useEffect(() => {
    (async () => {
      const cartRes = await fetch("/api/cart", { cache: "no-store" });
      const cartData: unknown = await cartRes.json().catch(() => null);

      if (!isRecord(cartData)) return;
      if (cartData.ok !== true) return;
      if (!getBool(cartData, "isAuthenticated")) return;

      const customerId = toNum(getField(cartData, "customerId"));
      if (!customerId) return;

      const serverItemsRaw = getField(cartData, "items");
      const serverItems: CartItem[] = collapse(parseCartItems(serverItemsRaw));

      const localItems = readLocal();
      const localCustomer = readLocalCustomerId();

      // Reorder flow has its own cart apply+sync path in CartClient.
      // Skip hydrator merge/mirror to avoid race-driven double-merge quantities.
      if (hasPendingReorderPayload()) return;

      // If local cart belongs to another logged-in account, keep server as source of truth.
      if (localCustomer && localCustomer !== customerId) {
        writeLocal(serverItems, customerId);
        return;
      }

      // ✅ If local already matches server, DO NOT merge again (it doubles quantities).
      if (localItems.length && sameCart(localItems, serverItems)) {
        writeLocal(serverItems, customerId);
        return;
      }

      // Merge local → server then write back (only when different)
      if (localItems.length) {
        const syncRes = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "merge", items: localItems }),
        });

        const syncData: unknown = await syncRes.json().catch(() => null);

        if (isRecord(syncData) && syncData.ok === true && getBool(syncData, "isAuthenticated")) {
          const mergedItemsRaw = getField(syncData, "items");
          if (Array.isArray(mergedItemsRaw)) {
            writeLocal(collapse(parseCartItems(mergedItemsRaw)), customerId);
            return;
          }
        }
      }

      // Otherwise mirror server
      writeLocal(serverItems, customerId);
    })();
  }, []);

  return null;
}