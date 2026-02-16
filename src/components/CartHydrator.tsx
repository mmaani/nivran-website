"use client";

import { useEffect } from "react";

const KEY = "nivran_cart_v1";
const KEY_CUS = "nivran_customer_id_v1";

type CartItem = { slug: string; name: string; priceJod: number; qty: number };

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
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

    out.push({ slug, name, priceJod, qty });
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

export default function CartHydrator() {
  useEffect(() => {
    (async () => {
      const cartRes = await fetch("/api/cart", { cache: "no-store" });
      const cartData: unknown = await cartRes.json().catch(() => null);

      if (!isRecord(cartData)) return;
      if (cartData.ok !== true) return;
      if (!getBool(cartData, "isAuthenticated")) return;

      const customerId = toNum(cartData.customerId);
      if (!customerId) return;

      const serverItems: CartItem[] = parseCartItems(cartData.items);

      const localItems = readLocal();
      const localCustomer = readLocalCustomerId();

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
          body: JSON.stringify({ mode: "merge", items: localItems }),
        });

        const syncData: unknown = await syncRes.json().catch(() => null);

        if (isRecord(syncData) && syncData.ok === true && getBool(syncData, "isAuthenticated")) {
          if (Array.isArray(syncData.items)) {
            writeLocal(parseCartItems(syncData.items), customerId);
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
