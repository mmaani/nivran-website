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
};

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const t = Math.trunc(n);
  return t > 0 ? t : null;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function parseCartItems(v: unknown): CartItem[] {
  if (!Array.isArray(v)) return [];
  const out: CartItem[] = [];

  for (const it of v) {
    if (!isRecord(it)) continue;

    const slug = toStr(it.slug).trim();
    if (!slug) continue;

    const name = toStr(it.name).trim();
    const priceJod = toNum(it.priceJod);
    const qty = Math.max(1, Math.floor(toNum(it.qty) || 1));

    // ✅ keep variantId if present (supports both variantId + variant_id)
    const variantId = toIntOrNull(it.variantId ?? it.variant_id);

    out.push({ slug, name, priceJod, qty, variantId });
  }

  return out;
}

function readLocal(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return parseCartItems(parsed);
  } catch {
    return [];
  }
}

function writeLocal(items: CartItem[], customerId?: number) {
  localStorage.setItem(KEY, JSON.stringify(items));
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
    const byQuery = new URL(window.location.href).searchParams.get("reorder") === "1";
    if (byQuery) return true;

    const raw = sessionStorage.getItem(REORDER_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && Array.isArray(parsed.items) && parsed.items.length > 0;
  } catch {
    return false;
  }
}

export default function CartHydrator() {
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cartRes = await fetch("/api/cart", { cache: "no-store" });
        const cartData: unknown = await cartRes.json().catch(() => null);

        if (!alive) return;
        if (!isRecord(cartData)) return;
        if (cartData.ok !== true) return;
        if (!getBool(cartData, "isAuthenticated")) return;

        const customerId = toNum(cartData.customerId);
        if (!customerId) return;

        const serverItems: CartItem[] = parseCartItems(cartData.items);

        const localItems = readLocal();
        const localCustomer = readLocalCustomerId();

        // ✅ Reorder flow has its own cart apply+sync path in CartClient.
        // Skip hydrator merge/mirror to avoid race-driven double-merge quantities.
        if (hasPendingReorderPayload()) return;

        // If local cart belongs to another logged-in account, keep server as source of truth.
        if (localCustomer && localCustomer !== customerId) {
          writeLocal(serverItems, customerId);
          return;
        }

        // Merge local → server then write back
        if (localItems.length) {
          const syncRes = await fetch("/api/cart/sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mode: "merge",
              items: localItems.map((it) => ({
                slug: it.slug,
                qty: it.qty,
                variantId: it.variantId ?? null,
              })),
            }),
          });

          const syncData: unknown = await syncRes.json().catch(() => null);

          if (!alive) return;

          if (isRecord(syncData) && syncData.ok === true && getBool(syncData, "isAuthenticated")) {
            if (Array.isArray(syncData.items)) {
              writeLocal(parseCartItems(syncData.items), customerId);
              return;
            }
          }
        }

        // Otherwise mirror server
        writeLocal(serverItems, customerId);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return null;
}