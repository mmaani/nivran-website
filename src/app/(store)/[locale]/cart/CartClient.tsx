"use client";

import React, { useEffect, useMemo, useState } from "react";

type Locale = "en" | "ar";

type CartItem = {
  slug: string;
  variantId: number;
  variantLabel: string;
  name: string;
  priceJod: number;
  qty: number;
};

const CART_KEY = "nivran_cart_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: unknown) => {
        const item = typeof x === "object" && x !== null ? (x as Record<string, unknown>) : {};
        return ({
        slug: String(item.slug || "").trim(),
        variantId: Math.max(0, Number(item.variantId || 0)),
        variantLabel: String(item.variantLabel || "").trim(),
        name: String(item.name || "").trim(),
        priceJod: Number(item.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(item.qty || 1))),
      });
      })
      .filter((x: CartItem) => !!x.slug && x.variantId > 0);
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

async function bestEffortSync(items: CartItem[]) {
  // Guest-safe endpoint; if not logged in it just 200s and does nothing.
  try {
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "replace", items }),
    });
  } catch {}
}

export default function CartClient({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";

  const [items, setItems] = useState<CartItem[]>([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setItems(readCart());
    const onCustom = () => setItems(readCart());
    window.addEventListener("nivran_cart_updated", onCustom as EventListener);
    return () => window.removeEventListener("nivran_cart_updated", onCustom as EventListener);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const shipping = items.length ? 3.5 : 0;
    const total = Number((subtotal + shipping).toFixed(2));
    const qty = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);
    return { subtotal, shipping, total, qty };
  }, [items]);

  const COPY = useMemo(
    () => ({
      title: isAr ? "السلة" : "Cart",
      empty: isAr ? "سلتك فارغة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      checkout: isAr ? "الدفع" : "Checkout",
      item: isAr ? "المنتج" : "Item",
      qty: isAr ? "الكمية" : "Qty",
      price: isAr ? "السعر" : "Price",
      subtotal: isAr ? "المجموع الفرعي" : "Subtotal",
      shipping: isAr ? "الشحن" : "Shipping",
      total: isAr ? "الإجمالي" : "Total",
      clear: isAr ? "تفريغ السلة" : "Clear cart",
      remove: isAr ? "حذف" : "Remove",
    }),
    [isAr]
  );

  function setAndSync(next: CartItem[]) {
    setItems(next);
    writeCart(next);
    bestEffortSync(next);
  }

  function inc(slug: string, variantId: number) {
    const next = items.map((i) => (i.slug === slug && i.variantId === variantId ? { ...i, qty: Math.min(99, i.qty + 1) } : i));
    setAndSync(next);
  }

  function dec(slug: string, variantId: number) {
    const next = items.map((i) => (i.slug === slug && i.variantId === variantId ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
    setAndSync(next);
  }

  function remove(slug: string, variantId: number) {
    const next = items.filter((i) => !(i.slug === slug && i.variantId === variantId));
    setAndSync(next);
  }

  async function clear() {
    setClearing(true);
    try {
      setAndSync([]);
      // Also clear server cart if logged in
      await fetch("/api/cart/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "clear" }),
      }).catch(() => null);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {COPY.title}
      </h1>

      {items.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {COPY.empty}
          </p>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {COPY.backToShop}
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="panel" style={{ display: "grid", gap: 12 }}>
            {items.map((i) => (
              <div
                key={`${i.slug}::${i.variantId}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  borderBottom: "1px solid #eee",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <strong>{i.name}</strong>
                  {i.variantLabel ? <div className="muted" style={{ marginTop: 4 }}>{i.variantLabel}</div> : null}
                  <div className="muted" style={{ marginTop: 4 }}>
                    {i.slug}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {COPY.price}: {Number(i.priceJod || 0).toFixed(2)} JOD
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn btn-outline" onClick={() => dec(i.slug, i.variantId)} aria-label="decrease">
                      −
                    </button>
                    <div style={{ minWidth: 28, textAlign: "center" }}>
                      <strong>{i.qty}</strong>
                    </div>
                    <button className="btn btn-outline" onClick={() => inc(i.slug, i.variantId)} aria-label="increase">
                      +
                    </button>
                  </div>

                  <button className="btn" onClick={() => remove(i.slug, i.variantId)}>
                    {COPY.remove}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 14 }}>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>{isAr ? "الملخص" : "Summary"}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">{COPY.subtotal}</span>
                  <strong>{totals.subtotal.toFixed(2)} JOD</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">{COPY.shipping}</span>
                  <strong>{totals.shipping.toFixed(2)} JOD</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                  <span>{COPY.total}</span>
                  <strong>{totals.total.toFixed(2)} JOD</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <a className="btn primary" href={`/${locale}/checkout`}>
                  {COPY.checkout}
                </a>
                <button className="btn btn-outline" onClick={clear} disabled={clearing}>
                  {COPY.clear}
                </button>
                <a className="btn btn-outline" href={`/${locale}/product`}>
                  {COPY.backToShop}
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
