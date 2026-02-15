"use client";

import React, { useEffect } from "react";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const CART_KEY = "nivran_cart_v1";
const CUSTOMER_KEY = "nivran_customer_id_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || "").trim(),
        name: String(x?.name || "").trim(),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {}
}

function readLocalCustomerId(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_KEY);
  } catch {
    return null;
  }
}

function writeLocalCustomerId(id: string) {
  try {
    localStorage.setItem(CUSTOMER_KEY, id);
  } catch {}
}

export default function CartHydrator() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Always safe now: /api/cart returns 200 even for guests
      const res = await fetch("/api/cart", { cache: "no-store" }).catch(() => null as any);
      if (!res || !res.ok) return;

      const data = await res.json().catch(() => null);
      if (!data?.ok) return;

      const customerId = data.customerId ? String(data.customerId) : null;

      // Guest → do nothing (keep local cart)
      if (!customerId) return;

      const serverItems = Array.isArray(data.items) ? (data.items as CartItem[]) : [];
      const localItems = readCart();

      // If user changed account, avoid mixing carts
      const lastCustomer = readLocalCustomerId();
      if (lastCustomer && lastCustomer !== customerId) {
        // Prefer server cart for the newly-logged-in account
        writeCart(serverItems);
        writeLocalCustomerId(customerId);
        return;
      }

      writeLocalCustomerId(customerId);

      // If local has items → merge into server, then overwrite local with canonical server response
      if (localItems.length) {
        const syncRes = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "merge", items: localItems }),
        }).catch(() => null as any);

        if (!syncRes || !syncRes.ok) return;
        const syncData = await syncRes.json().catch(() => null);
        if (!syncData?.ok) return;

        const merged = Array.isArray(syncData.items) ? (syncData.items as CartItem[]) : [];
        if (!cancelled) writeCart(merged);
        return;
      }

      // If local empty but server has items → hydrate local
      if (!localItems.length && serverItems.length) {
        if (!cancelled) writeCart(serverItems);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
