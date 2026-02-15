"use client";

import { useEffect } from "react";

type CartItem = { slug: string; name: string; priceJod: number; qty: number };

const CART_KEY = "nivran_cart_v1";
const CART_CUSTOMER_KEY = "nivran_cart_customer_v1";

function readLocal(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: any) => ({
        slug: String(x?.slug || ""),
        name: String(x?.name || ""),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeLocal(items: CartItem[], customerId?: number) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  if (customerId) localStorage.setItem(CART_CUSTOMER_KEY, String(customerId));
  window.dispatchEvent(new Event("nivran_cart_updated"));
}

export default function CartHydrator() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Check if user is logged-in by calling /api/cart (401 means guest)
      const res = await fetch("/api/cart", { cache: "no-store" }).catch(() => null);
      if (!res || res.status === 401) return;

      const data = await res.json().catch(() => null);
      if (!data?.ok) return;

      const customerId = Number(data.customerId || 0);
      const serverItems: CartItem[] = Array.isArray(data.items) ? data.items : [];
      if (cancelled) return;

      const localItems = readLocal();
      const localCustomer = Number(localStorage.getItem(CART_CUSTOMER_KEY) || 0);

      // If local cart belongs to a DIFFERENT customer -> replace (avoid mixing accounts)
      if (localCustomer && customerId && localCustomer !== customerId) {
        writeLocal(serverItems, customerId);
        return;
      }

      // If guest cart exists -> merge it into account cart once
      if (localItems.length) {
        const sync = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: localItems }),
          cache: "no-store",
        }).catch(() => null);

        if (sync && sync.ok) {
          const j = await sync.json().catch(() => null);
          if (j?.ok && Array.isArray(j.items)) writeLocal(j.items, customerId);
          return;
        }
      }

      // Otherwise: server → local
      writeLocal(serverItems, customerId);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
