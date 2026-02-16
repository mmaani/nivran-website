"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Locale = "en" | "ar";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const CART_KEY = "nivran_cart_v1";
const SHIPPING_JOD = 3.5;

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Error";
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((x): CartItem => {
        const o: JsonObject = isObject(x) ? x : {};
        const slug = toStr(o.slug).trim();
        const name = toStr(o.name).trim();
        const priceJod = toNum(o.priceJod);
        const qtyRaw = Math.trunc(toNum(o.qty));
        const qty = Math.max(1, Math.min(99, qtyRaw || 1));

        return {
          slug,
          name,
          priceJod,
          qty,
        };
      })
      .filter((x) => x.slug.length > 0);
  } catch {
    return [];
  }
}

function clearCart() {
  try {
    localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {
    // ignore
  }
}

export default function CheckoutClient() {
  const p = useParams<{ locale?: string }>();
  const locale: Locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const sp = useSearchParams();
  const buyNowSlug = String(sp.get("slug") || "").trim();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingBuyNow, setLoadingBuyNow] = useState(false);

  // Customer/shipping fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Order state
  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load cart from localStorage, or Buy Now from API if cart is empty
  useEffect(() => {
    const cart = readCart();
    if (cart.length) {
      setItems(cart);
      return;
    }

    if (!buyNowSlug) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoadingBuyNow(true);

    fetch(`/api/catalog/product-by-slug?slug=${encodeURIComponent(buyNowSlug)}`)
      .then(async (r) => {
        const j: unknown = await r.json().catch(() => null);
        if (cancelled) return;

        if (!isObject(j) || j.ok !== true || !isObject(j.product)) return;

        const prod = j.product;
        const slug = toStr(prod.slug).trim();
        if (!slug) return;

        const prodName = isAr
          ? toStr(prod.name_ar || prod.name_en || slug)
          : toStr(prod.name_en || prod.name_ar || slug);

        const price = toNum(prod.price_jod);

        setItems([{ slug, name: prodName, priceJod: price, qty: 1 }]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBuyNow(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buyNowSlug, isAr]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const shipping = items.length ? SHIPPING_JOD : 0;
    const total = Number((subtotal + shipping).toFixed(2));
    const qty = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);
    return { subtotal, shipping, total, qty };
  }, [items]);

  const COPY = useMemo(
    () => ({
      title: isAr ? "الدفع" : "Checkout",
      empty: isAr ? "لا توجد عناصر في السلة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      editCart: isAr ? "تعديل السلة" : "Edit cart",
      loadingProduct: isAr ? "جارٍ تحميل المنتج..." : "Loading product...",
      required: isAr
        ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة"
        : "Name, phone, address, and email are required",
      payCard: isAr ? "الدفع بالبطاقة" : "Pay by card",
      cod: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
      orderSummary: isAr ? "ملخص الطلب" : "Order summary",
      subtotal: isAr ? "المجموع الفرعي" : "Subtotal",
      shipping: isAr ? "الشحن" : "Shipping",
      total: isAr ? "الإجمالي" : "Total",
      fullName: isAr ? "الاسم الكامل" : "Full name",
      phone: isAr ? "رقم الهاتف" : "Phone",
      email: isAr ? "البريد الإلكتروني" : "Email",
      city: isAr ? "المدينة" : "City",
      address: isAr ? "العنوان" : "Address",
      notes: isAr ? "ملاحظات" : "Notes",
      placed: isAr ? "تم إنشاء الطلب." : "Order created.",
    }),
    [isAr]
  );

  function validate() {
    if (!items.length) {
      setErr(COPY.empty);
      return false;
    }
    if (!name.trim() || !phone.trim() || !address.trim() || !email.includes("@")) {
      setErr(COPY.required);
      return false;
    }
    return true;
  }

  async function createOrder(paymentMethod: "PAYTABS" | "COD") {
    const payload = {
      locale,
      paymentMethod,
      items: items.map((i) => ({ slug: i.slug, qty: i.qty })), // server will re-price
      customer: { name, phone, email },
      shipping: { city, address, country: "Jordan", notes },
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let data: unknown = null;

    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(`Order create failed (${res.status})`);
      }
    }

    const ok = isObject(data) && data.ok === true;
    if (!res.ok || !ok) {
      const msg = isObject(data) && typeof data.error === "string" ? data.error : "";
      throw new Error(msg || `Order create failed (${res.status})`);
    }

    const cid = isObject(data) ? toStr(data.cartId).trim() : "";
    const st = isObject(data) ? toStr(data.status).trim() : "";

    setCartId(cid || null);
    setStatus(st || null);
    return cid;
  }

  async function payByCard() {
    if (!validate()) return;
    setLoading(true);
    setErr(null);

    try {
      const cid = await createOrder("PAYTABS");

      const res = await fetch("/api/paytabs/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartId: cid }),
      });

      const data: unknown = await res.json().catch(() => null);

      const ok = isObject(data) && data.ok === true;
      if (!res.ok || !ok) {
        const msg = isObject(data) && typeof data.error === "string" ? data.error : "";
        throw new Error(msg || "PayTabs initiate failed");
      }

      const redirectUrl =
        (isObject(data) && typeof data.redirectUrl === "string" && data.redirectUrl) ||
        (isObject(data) && typeof data.redirect_url === "string" && data.redirect_url) ||
        "";

      if (!redirectUrl) throw new Error("PayTabs redirect URL missing");

      // Clear cart only once user is leaving to payment (so they don’t pay twice)
      clearCart();
      window.location.href = redirectUrl;
    } catch (e: unknown) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function cashOnDelivery() {
    if (!validate()) return;
    setLoading(true);
    setErr(null);

    try {
      await createOrder("COD");
      clearCart();
      setErr(COPY.placed);
    } catch (e: unknown) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {COPY.title}
      </h1>

      {loadingBuyNow ? <p className="muted">{COPY.loadingProduct}</p> : null}

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
        <div className="grid-2">
          <section className="panel" style={{ display: "grid", gap: ".55rem" }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={COPY.fullName} />
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={COPY.phone} />
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={COPY.email} />
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={COPY.city} />
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={COPY.address} />
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={COPY.notes} />

            {err && <p style={{ color: err === COPY.placed ? "seagreen" : "crimson", margin: 0 }}>{err}</p>}

            <div className="cta-row">
              <button className="btn primary" onClick={payByCard} disabled={loading}>
                {COPY.payCard}
              </button>
              <button className="btn" onClick={cashOnDelivery} disabled={loading}>
                {COPY.cod}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <a className="btn btn-outline" href={`/${locale}/cart`}>
                {COPY.editCart}
              </a>
              <a className="btn btn-outline" href={`/${locale}/product`}>
                {COPY.backToShop}
              </a>
            </div>
          </section>

          <aside className="panel">
            <h3 style={{ marginTop: 0 }}>{COPY.orderSummary}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => (
                <div key={i.slug} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{i.name}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {i.qty} × {Number(i.priceJod || 0).toFixed(2)} JOD
                    </div>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {i.slug}
                    </div>
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

            {cartId ? (
              <p style={{ marginBottom: 0, fontFamily: "monospace", marginTop: 12 }}>
                cart_id: {cartId} {status ? `(${status})` : null}
              </p>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
