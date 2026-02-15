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

function waLink(phoneE164: string, msg: string) {
  return `https://wa.me/${phoneE164}?text=${encodeURIComponent(msg)}`;
}

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
        qty: Math.max(1, Number(x?.qty || 1)),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

export default function CheckoutPage() {
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

    if (buyNowSlug) {
      setLoadingBuyNow(true);
      fetch(`/api/catalog/product-by-slug?slug=${encodeURIComponent(buyNowSlug)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok || !j?.product) return;
          const prod = j.product;
          const prodName = isAr
            ? String(prod.name_ar || prod.name_en || prod.slug)
            : String(prod.name_en || prod.name_ar || prod.slug);
          const price = Number(prod.price_jod || 0);
          setItems([{ slug: prod.slug, name: prodName, priceJod: price, qty: 1 }]);
        })
        .finally(() => setLoadingBuyNow(false));
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyNowSlug, locale]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1),
      0
    );
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
      required: isAr ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة" : "Name, phone, address, and email are required",
      payCard: isAr ? "الدفع بالبطاقة" : "Pay by card",
      cod: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
      confirmWa: isAr ? "تأكيد عبر واتساب" : "Confirm on WhatsApp",
      orderSummary: isAr ? "ملخص الطلب" : "Order summary",
      product: isAr ? "المنتجات" : "Items",
      subtotal: isAr ? "المجموع الفرعي" : "Subtotal",
      shipping: isAr ? "الشحن" : "Shipping",
      total: isAr ? "الإجمالي" : "Total",
      fullName: isAr ? "الاسم الكامل" : "Full name",
      phone: isAr ? "رقم الهاتف" : "Phone",
      email: isAr ? "البريد الإلكتروني" : "Email",
      city: isAr ? "المدينة" : "City",
      address: isAr ? "العنوان" : "Address",
      notes: isAr ? "ملاحظات" : "Notes",
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

  async function createOrder(mode: "PAYTABS" | "COD") {
    const payload = {
      mode,
      locale,
      // keep qty for backward compatibility with older /api/orders handlers
      qty: totals.qty,
      items,
      totals: { subtotalJod: totals.subtotal, shippingJod: totals.shipping, totalJod: totals.total },
      customer: { name, phone, email },
      shipping: { city, address, notes },
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let data: any = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Order create failed (${res.status})`);
      }
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Order create failed (${res.status})`);
    }

    setCartId(String(data.cartId || ""));
    setStatus(String(data.status || ""));
    return String(data.cartId || "");
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
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "PayTabs initiate failed");
      window.location.href = data.redirectUrl || data.redirect_url;
    } catch (e: any) {
      setErr(e?.message || "Error");
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
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  const waNum = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").trim();
  const waLines = items
    .map((i) => `- ${i.qty}× ${i.name} (${i.slug})`)
    .join("\n");
  const waMsg =
    cartId && items.length
      ? `NIVRAN COD Confirmation\nCart: ${cartId}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nItems:\n${waLines}\nTotal: ${totals.total.toFixed(
          2
        )} JOD`
      : "";

  const showWhatsAppConfirm = status === "PENDING_COD_CONFIRM" && !!waNum && !!cartId;

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
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={COPY.fullName}
            />
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={COPY.phone}
            />
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={COPY.email}
            />
            <input
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={COPY.city}
            />
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={COPY.address}
            />
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={COPY.notes}
            />

            {err && <p style={{ color: "crimson", margin: 0 }}>{err}</p>}

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

            {showWhatsAppConfirm ? (
              <a
                className="btn"
                style={{ marginTop: 12 }}
                href={waLink(waNum, waMsg)}
                target="_blank"
                rel="noreferrer"
              >
                {COPY.confirmWa}
              </a>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
