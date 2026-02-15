"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const KEY = "nivran_cart_v1";
const SHIPPING_JOD = 3.5;

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

export default function CheckoutClient({ locale }: { locale: "en" | "ar" }) {
  const isAr = locale === "ar";
  const sp = useSearchParams();
  const buyNowSlug = String(sp.get("slug") || "").trim();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingBuyNow, setLoadingBuyNow] = useState(false);

  useEffect(() => {
    const cart = readCart();
    if (cart.length) {
      setItems(cart);
      return;
    }

    // If cart is empty but /checkout?slug=... is used (Buy now), fetch product from DB via API
    if (buyNowSlug) {
      setLoadingBuyNow(true);
      fetch(`/api/catalog/product-by-slug?slug=${encodeURIComponent(buyNowSlug)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok || !j?.product) return;
          const p = j.product;
          const name = isAr ? String(p.name_ar || p.name_en || p.slug) : String(p.name_en || p.name_ar || p.slug);
          const price = Number(p.price_jod || 0);
          setItems([{ slug: p.slug, name, priceJod: price, qty: 1 }]);
        })
        .finally(() => setLoadingBuyNow(false));
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyNowSlug, locale]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0),
    [items]
  );
  const shipping = items.length ? SHIPPING_JOD : 0;
  const total = subtotal + shipping;

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {isAr ? "إتمام الشراء" : "Checkout"}
      </h1>

      {loadingBuyNow ? (
        <p className="muted">{isAr ? "جارٍ تحميل المنتج..." : "Loading product..."}</p>
      ) : null}

      {items.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {isAr ? "لا توجد عناصر في السلة." : "Your cart is empty."}
          </p>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {isAr ? "العودة للمتجر" : "Back to shop"}
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>{isAr ? "ملخص الطلب" : "Order summary"}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => (
                <div key={i.slug} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{i.name}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {i.qty} × {Number(i.priceJod || 0).toFixed(2)} JOD
                    </div>
                    <div className="muted" style={{ marginTop: 2 }}>{i.slug}</div>
                  </div>
                  <div style={{ minWidth: 120, textAlign: "end" }}>
                    <strong>{(Number(i.priceJod || 0) * Number(i.qty || 1)).toFixed(2)} JOD</strong>
                  </div>
                </div>
              ))}
            </div>

            <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid #eee" }} />

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{isAr ? "المجموع الفرعي" : "Subtotal"}</span>
                <strong>{subtotal.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{isAr ? "الشحن" : "Shipping"}</span>
                <strong>{shipping.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                <span>{isAr ? "الإجمالي" : "Total"}</span>
                <strong>{total.toFixed(2)} JOD</strong>
              </div>
            </div>
          </div>

          {/* Keep your PayTabs/checkout flow below this block.
              If your existing checkout page had a payment form, put it under here. */}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a className="btn btn-outline" href={`/${locale}/cart`}>
              {isAr ? "تعديل السلة" : "Edit cart"}
            </a>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {isAr ? "العودة للمتجر" : "Back to shop"}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
