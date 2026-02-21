"use client";

import React, { useEffect, useMemo, useState } from "react";
import { normalizeCartItems, type CartItem } from "@/lib/cartStore";

type Locale = "en" | "ar";

type JsonRecord = Record<string, unknown>;

const CART_KEY = "nivran_cart_v1";

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return normalizeCartItems(parsed);
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

type QuoteLine = {
  slug: string;
  qty: number;
  requestedVariantId: number | null;
  unitPriceJod: number;
  lineTotalJod: number;
  variantLabel: string | null;
};

type QuotePayload = {
  lines: QuoteLine[];
  totals: {
    subtotalBeforeDiscountJod: number;
    discountJod: number;
    subtotalAfterDiscountJod: number;
    shippingJod: number;
    totalJod: number;
    freeShippingThresholdJod: number;
  };
  discount: {
    source: "AUTO" | "CODE" | null;
    code: string | null;
    promotionId: number | null;
    titleEn?: string | null;
    titleAr?: string | null;
  };
};

function buildKey(slug: string, requestedVariantId: number | null | undefined): string {
  return `${slug}::${requestedVariantId ?? 0}`;
}

export default function CartClient({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";

  const [items, setItems] = useState<CartItem[]>([]);
  const [clearing, setClearing] = useState(false);

  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    setItems(readCart());
    const onCustom = () => setItems(readCart());
    window.addEventListener("nivran_cart_updated", onCustom as EventListener);
    return () => window.removeEventListener("nivran_cart_updated", onCustom as EventListener);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setQuoteError(null);
      if (!items.length) {
        setQuote(null);
        return;
      }

      try {
        const res = await fetch("/api/pricing/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            locale,
            discountMode: "AUTO",
            items: items.map((i) => ({ slug: i.slug, qty: i.qty, variantId: i.variantId })),
          }),
        });

        const data: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !isRecord(data) || data.ok !== true || !isRecord(data.quote)) {
          setQuote(null);
          setQuoteError(isAr ? "تعذر تحديث الأسعار الآن" : "Unable to refresh pricing right now");
          return;
        }

        const q = data.quote;
        if (!isRecord(q) || !Array.isArray(q.lines) || !isRecord(q.totals) || !isRecord(q.discount)) {
          setQuote(null);
          return;
        }

        const lines: QuoteLine[] = q.lines
          .map((l: unknown) => {
            if (!isRecord(l)) return null;
            const slug = String(l.slug || "").trim();
            if (!slug) return null;
            return {
              slug,
              qty: Math.max(1, Math.min(99, Math.trunc(toNum(l.qty) || 1))),
              requestedVariantId: ((): number | null => {
                const n = toNum(l.requestedVariantId);
                return n > 0 ? Math.trunc(n) : null;
              })(),
              unitPriceJod: toNum(l.unitPriceJod),
              lineTotalJod: toNum(l.lineTotalJod),
              variantLabel: typeof l.variantLabel === "string" ? l.variantLabel : null,
            };
          })
          .filter((x): x is QuoteLine => !!x);

        const totals = {
          subtotalBeforeDiscountJod: toNum(q.totals.subtotalBeforeDiscountJod),
          discountJod: toNum(q.totals.discountJod),
          subtotalAfterDiscountJod: toNum(q.totals.subtotalAfterDiscountJod),
          shippingJod: toNum(q.totals.shippingJod),
          totalJod: toNum(q.totals.totalJod),
          freeShippingThresholdJod: toNum(q.totals.freeShippingThresholdJod),
        };

        const discount = {
          source: ((): "AUTO" | "CODE" | null => {
            const s = String(q.discount.source || "").toUpperCase();
            if (s === "AUTO" || s === "CODE") return s;
            return null;
          })(),
          code: typeof q.discount.code === "string" ? q.discount.code : null,
          promotionId: ((): number | null => {
            const n = toNum(q.discount.promotionId);
            return n > 0 ? Math.trunc(n) : null;
          })(),
          titleEn: typeof q.discount.titleEn === "string" ? q.discount.titleEn : null,
          titleAr: typeof q.discount.titleAr === "string" ? q.discount.titleAr : null,
        };

        setQuote({ lines, totals, discount });
      } catch {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(isAr ? "تعذر تحديث الأسعار الآن" : "Unable to refresh pricing right now");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [items, isAr, locale]);

  const lineMap = useMemo(() => {
    const m = new Map<string, QuoteLine>();
    for (const l of quote?.lines || []) {
      m.set(buildKey(l.slug, l.requestedVariantId), l);
    }
    return m;
  }, [quote?.lines]);

  const totals = useMemo(() => {
    if (quote) {
      return {
        subtotal: quote.totals.subtotalBeforeDiscountJod,
        discount: quote.totals.discountJod,
        shipping: quote.totals.shippingJod,
        total: quote.totals.totalJod,
      };
    }

    // fallback (legacy)
    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const shipping = items.length ? 3.5 : 0;
    const total = Number((subtotal + shipping).toFixed(2));
    return { subtotal, discount: 0, shipping, total };
  }, [items, quote]);

  const COPY = useMemo(
    () => ({
      title: isAr ? "السلة" : "Cart",
      empty: isAr ? "سلتك فارغة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      checkout: isAr ? "الدفع" : "Checkout",
      price: isAr ? "السعر" : "Price",
      subtotal: isAr ? "المجموع قبل الخصم" : "Subtotal",
      discount: isAr ? "الخصم" : "Discount",
      shipping: isAr ? "الشحن" : "Shipping",
      total: isAr ? "الإجمالي" : "Total",
      clear: isAr ? "تفريغ السلة" : "Clear cart",
      remove: isAr ? "حذف" : "Remove",
      seasonal: isAr ? "خصم موسمي" : "Seasonal discount",
    }),
    [isAr]
  );

  function setAndSync(next: CartItem[]) {
    setItems(next);
    writeCart(next);
    bestEffortSync(next);
  }

  function inc(slugKey: string) {
    const next = items.map((i) => (`${i.slug}::${i.variantId ?? 0}` === slugKey ? { ...i, qty: Math.min(99, i.qty + 1) } : i));
    setAndSync(next);
  }

  function dec(slugKey: string) {
    const next = items.map((i) => (`${i.slug}::${i.variantId ?? 0}` === slugKey ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
    setAndSync(next);
  }

  function remove(slugKey: string) {
    const next = items.filter((i) => `${i.slug}::${i.variantId ?? 0}` !== slugKey);
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

  const seasonalLabel = useMemo(() => {
    if (!quote) return null;
    if (quote.discount.source !== "AUTO") return null;
    if (!(quote.totals.discountJod > 0)) return null;
    const title = isAr ? quote.discount.titleAr : quote.discount.titleEn;
    return (title && String(title).trim()) || COPY.seasonal;
  }, [quote, isAr, COPY.seasonal]);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {COPY.title}
      </h1>

      {quoteError ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {quoteError}
        </p>
      ) : null}

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
          {seasonalLabel ? (
            <div className="panel" style={{ marginBottom: 12, background: "linear-gradient(130deg,#fff,#fff8ee)", border: "1px solid #f0e1c4" }}>
              <strong>{seasonalLabel}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                -{toNum(quote?.totals.discountJod).toFixed(2)} JOD
              </div>
            </div>
          ) : null}

          <div className="panel" style={{ display: "grid", gap: 12 }}>
            {items.map((i) => {
              const key = `${i.slug}::${i.variantId ?? 0}`;
              const live = lineMap.get(key);
              const unit = live ? live.unitPriceJod : Number(i.priceJod || 0);
              const lineTotal = live ? live.lineTotalJod : Number((unit * Number(i.qty || 1)).toFixed(2));

              return (
                <div
                  key={key}
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
                    <div className="muted" style={{ marginTop: 4 }}>
                      {i.variantLabel ? `${i.slug} · ${i.variantLabel}` : i.slug}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {COPY.price}: {unit.toFixed(2)} JOD
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    <div style={{ minWidth: 120, textAlign: "end" }}>
                      <strong>{lineTotal.toFixed(2)} JOD</strong>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="btn btn-outline" onClick={() => dec(key)} aria-label="decrease">
                        −
                      </button>
                      <div style={{ minWidth: 28, textAlign: "center" }}>
                        <strong>{i.qty}</strong>
                      </div>
                      <button className="btn btn-outline" onClick={() => inc(key)} aria-label="increase">
                        +
                      </button>
                    </div>

                    <button className="btn" onClick={() => remove(key)}>
                      {COPY.remove}
                    </button>
                  </div>
                </div>
              );
            })}
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
                  <span className="muted">{COPY.discount}</span>
                  <strong>-{totals.discount.toFixed(2)} JOD</strong>
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
