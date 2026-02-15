"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const KEY = "nivran_cart_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || ""),
        name: String(x?.name || ""),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Number(x?.qty || 1)),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export default function CartClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";
  const router = useRouter();
  const sp = useSearchParams();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart());
  }, []);

  // Optional: remove ?added=1 from URL after showing
  useEffect(() => {
    if (sp.get("added")) {
      router.replace(`/${locale}/cart`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.priceJod || 0) * Number(i.qty || 1)), 0),
    [items]
  );

  function updateQty(slug: string, nextQty: number) {
    const n = Math.max(1, nextQty);
    const next = items.map((i) => (i.slug === slug ? { ...i, qty: n } : i));
    setItems(next);
    writeCart(next);
  }

  function remove(slug: string) {
    const next = items.filter((i) => i.slug !== slug);
    setItems(next);
    writeCart(next);
  }

  function clear() {
    setItems([]);
    writeCart([]);
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {isAr ? "السلة" : "Cart"}
      </h1>

      {items.length === 0 ? (
        <p className="muted">{isAr ? "سلتك فارغة حالياً." : "Your cart is empty."}</p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((i) => (
              <div key={i.slug} className="panel" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <strong>{i.name}</strong>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {i.priceJod.toFixed(2)} JOD
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {i.slug}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-outline" onClick={() => updateQty(i.slug, i.qty - 1)}>
                    −
                  </button>
                  <div style={{ minWidth: 36, textAlign: "center" }}>
                    <strong>{i.qty}</strong>
                  </div>
                  <button className="btn btn-outline" onClick={() => updateQty(i.slug, i.qty + 1)}>
                    +
                  </button>
                </div>

                <button className="btn btn-outline" onClick={() => remove(i.slug)}>
                  {isAr ? "حذف" : "Remove"}
                </button>
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="muted">{isAr ? "الإجمالي" : "Total"}</div>
              <div style={{ fontSize: 18 }}>
                <strong>{total.toFixed(2)} JOD</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-outline" onClick={clear}>
                {isAr ? "تفريغ السلة" : "Clear cart"}
              </button>
              <a className="btn" href={`/${locale}/checkout`}>
                {isAr ? "إتمام الشراء" : "Checkout"}
              </a>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 14 }}>
        <a className="btn btn-outline" href={`/${locale}/product`}>
          {isAr ? "متابعة التسوق" : "Continue shopping"}
        </a>
      </div>
    </div>
  );
}
