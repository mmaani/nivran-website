"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const SHIPPING = 3.5; // Flat nationwide (JOD)
const FALLBACK_ITEM_PRICE = 18.0;

const COPY = {
  en: {
    title: "Checkout",
    subtitle: "Secure payment via PayTabs, or Cash on Delivery (COD).",
    contact: "Contact details",
    shipping: "Shipping address",
    name: "Full name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    city: "City",
    country: "Country",
    payCard: "Pay by card (PayTabs)",
    payCod: "Cash on Delivery (COD)",
    processing: "Processing…",
    summary: "Order summary",
    subtotal: "Subtotal",
    ship: "Shipping",
    total: "Total",
    item: "Item",
    confirmWa: "Confirm COD on WhatsApp",
    errors: {
      required: "Please fill in all required fields.",
      product: "Could not load product. Try again.",
      paytabs: "Payment initialization failed.",
    },
  },
  ar: {
    title: "الدفع",
    subtitle: "دفع آمن عبر PayTabs أو الدفع عند الاستلام.",
    contact: "بيانات التواصل",
    shipping: "عنوان الشحن",
    name: "الاسم الكامل",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    address: "العنوان",
    city: "المدينة",
    country: "الدولة",
    payCard: "الدفع بالبطاقة (PayTabs)",
    payCod: "الدفع عند الاستلام",
    processing: "جارٍ المعالجة…",
    summary: "ملخص الطلب",
    subtotal: "المجموع الفرعي",
    ship: "الشحن",
    total: "الإجمالي",
    item: "المنتج",
    confirmWa: "تأكيد الدفع عند الاستلام على واتساب",
    errors: {
      required: "يرجى تعبئة الحقول المطلوبة.",
      product: "تعذّر تحميل المنتج. حاول مرة أخرى.",
      paytabs: "فشل تهيئة الدفع.",
    },
  },
};

function waLink(number: string, message: string) {
  const t = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${t}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const search = useSearchParams();

  const locale = params?.locale === "ar" ? "ar" : "en";
  const t = COPY[locale];

  const slugFromUrl = (search?.get("slug") || "").trim();

  const [loadingProduct, setLoadingProduct] = useState<boolean>(!!slugFromUrl);
  const [product, setProduct] = useState<any | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: locale === "ar" ? "Jordan" : "Jordan",
  });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!slugFromUrl) return;
      setLoadingProduct(true);
      setProductError(null);
      try {
        const r = await fetch(`/api/catalog/product?slug=${encodeURIComponent(slugFromUrl)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed");
        if (!cancelled) setProduct(j.product);
      } catch (e: any) {
        if (!cancelled) setProductError(t.errors.product);
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugFromUrl, locale]);

  const subtotal = useMemo(() => {
    const v = product?.final_price_jod ?? product?.price_jod ?? FALLBACK_ITEM_PRICE;
    return Number(v || 0);
  }, [product]);

  const total = useMemo(() => subtotal + SHIPPING, [subtotal]);

  const itemLabel = useMemo(() => {
    if (!product) return locale === "ar" ? "منتج" : "Item";
    return locale === "ar" ? product.name_ar : product.name_en;
  }, [product, locale]);

  function onChange(k: string, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function validate(): boolean {
    if (!form.name || !form.phone || !form.address || !form.city || !form.country) return false;
    // email is optional for MVP
    return true;
  }

  async function createOrder(paymentMethod: "PAYTABS" | "COD") {
    const payload = {
      locale,
      paymentMethod,
      productSlug: product?.slug || (slugFromUrl || null),
      qty: 1,
      customer: {
        name: form.name,
        email: form.email || null,
        phone: form.phone,
      },
      shipping: {
        address: form.address,
        city: form.city,
        country: form.country,
      },
    };

    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json();
    if (!r.ok || !j?.ok) throw new Error(j?.error || "order_failed");
    return j as { ok: true; cartId: string; status: string };
  }

  async function payByCard() {
    setErr(null);
    if (!validate()) {
      setErr(t.errors.required);
      return;
    }
    if (productError) {
      setErr(productError);
      return;
    }

    setBusy(true);
    try {
      const order = await createOrder("PAYTABS");
      setCartId(order.cartId);
      setStatus(order.status);

      const r = await fetch("/api/paytabs/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartId: order.cartId, locale }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok || !j?.redirectUrl) throw new Error("paytabs_init_failed");
      router.push(j.redirectUrl);
    } catch (e: any) {
      setErr(t.errors.paytabs);
    } finally {
      setBusy(false);
    }
  }

  async function cashOnDelivery() {
    setErr(null);
    if (!validate()) {
      setErr(t.errors.required);
      return;
    }
    if (productError) {
      setErr(productError);
      return;
    }

    setBusy(true);
    try {
      const order = await createOrder("COD");
      setCartId(order.cartId);
      setStatus(order.status);
    } catch (e: any) {
      setErr("Failed to create order");
    } finally {
      setBusy(false);
    }
  }

  const waNum = process.env.NEXT_PUBLIC_WA_NUMBER || "";
  const waMsg = useMemo(() => {
    const pieces = [
      `NIVRAN COD confirmation`,
      cartId ? `cart_id: ${cartId}` : "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Address: ${form.address}, ${form.city}, ${form.country}`,
      product ? `Item: ${product.slug}` : slugFromUrl ? `Item: ${slugFromUrl}` : "",
      `Total: ${total.toFixed(2)} JOD`,
    ].filter(Boolean);
    return pieces.join("\n");
  }, [cartId, form, product, slugFromUrl, total]);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {t.title}
      </h1>
      <p className="lead" style={{ marginTop: 0 }}>
        {t.subtitle}
      </p>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>{t.contact}</h2>

          <div className="form-grid">
            <div>
              <label className="label">{t.name} *</label>
              <input className="input" value={form.name} onChange={(e) => onChange("name", e.target.value)} />
            </div>
            <div>
              <label className="label">{t.phone} *</label>
              <input className="input ltr" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">{t.email}</label>
              <input className="input ltr" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
            </div>
          </div>

          <hr style={{ margin: "16px 0", borderColor: "#eee" }} />

          <h2 style={{ marginTop: 0 }}>{t.shipping}</h2>
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t.address} *</label>
              <input className="input" value={form.address} onChange={(e) => onChange("address", e.target.value)} />
            </div>
            <div>
              <label className="label">{t.city} *</label>
              <input className="input" value={form.city} onChange={(e) => onChange("city", e.target.value)} />
            </div>
            <div>
              <label className="label">{t.country} *</label>
              <input className="input" value={form.country} onChange={(e) => onChange("country", e.target.value)} />
            </div>
          </div>

          {err ? (
            <p style={{ marginTop: 14, color: "#b00" }}>
              {err}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button className="btn" onClick={payByCard} disabled={busy || loadingProduct}>
              {busy ? t.processing : t.payCard}
            </button>
            <button className="btn btn-outline" onClick={cashOnDelivery} disabled={busy || loadingProduct}>
              {busy ? t.processing : t.payCod}
            </button>
          </div>
        </section>

        <aside className="panel">
          <h2 style={{ marginTop: 0 }}>{t.summary}</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{t.item}</span>
              <span style={{ textAlign: "end" }}>{loadingProduct ? "…" : itemLabel}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{t.subtotal}</span>
              <span className="ltr">{subtotal.toFixed(2)} JOD</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{t.ship}</span>
              <span className="ltr">{SHIPPING.toFixed(2)} JOD</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 700 }}>
              <span>{t.total}</span>
              <span className="ltr">{total.toFixed(2)} JOD</span>
            </div>
          </div>

          {cartId ? <p style={{ marginTop: 14 }} className="ltr">cart_id: {cartId} ({status})</p> : null}
          {status === "PENDING_COD_CONFIRM" && waNum ? (
            <a className="btn" href={waLink(waNum, waMsg)} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
              {t.confirmWa}
            </a>
          ) : null}

          {product?.images?.length ? (
            <div style={{ marginTop: 14 }}>
              <img
                src={product.images[0].url}
                alt={itemLabel}
                style={{ width: "100%", borderRadius: 14, border: "1px solid #eee" }}
              />
            </div>
          ) : null}
        </aside>
      </div>

      <style jsx global>{`
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 0.8fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .grid-2 {
            grid-template-columns: 1fr;
          }
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 700px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
        .label {
          display: block;
          font-size: 13px;
          opacity: 0.8;
          margin-bottom: 6px;
        }
        .input {
          width: 100%;
          border: 1px solid #e6e6e6;
          border-radius: 12px;
          padding: 10px 12px;
          font: inherit;
          background: #fff;
        }
        .ltr {
          direction: ltr;
          unicode-bidi: plaintext;
        }
      `}</style>
    </div>
  );
}
