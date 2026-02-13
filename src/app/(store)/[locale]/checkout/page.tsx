"use client";

import { useMemo, useState } from "react";

type Props = { params: { locale: string } };

const SHIPPING = 3.5;
const PRICE = 18.0;

function waLink(phoneE164: string, msg: string) {
  const text = encodeURIComponent(msg);
  return `https://wa.me/${phoneE164}?text=${text}`;
}

export default function CheckoutPage({ params }: Props) {
  const locale = params?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = PRICE;
    const total = Number((subtotal + SHIPPING).toFixed(2));
    return { subtotal, shipping: SHIPPING, total };
  }, []);

  const COPY = {
    title: isAr ? "الدفع" : "Checkout",
    subtitle: isAr ? "نيفـران — ارتدِ الهدوء" : "NIVRAN — Wear the calm.",
    payCard: isAr ? "ادفع بالبطاقة" : "Pay by Card",
    cod: isAr ? "الدفع عند الاستلام" : "Cash on Delivery",
    confirmWa: isAr ? "تأكيد عبر واتساب" : "Confirm on WhatsApp",
    required: isAr ? "الاسم ورقم الهاتف والعنوان مطلوبة" : "Name, phone, and address are required",
    summary: isAr ? "ملخص الطلب" : "Order summary",
    product: isAr ? "منتج (100مل)" : "Product (100ml)",
    shipping: isAr ? "الشحن" : "Shipping",
    total: isAr ? "الإجمالي" : "Total",
    processing: isAr ? "جارٍ المعالجة…" : "Processing…",
    status: isAr ? "الحالة" : "Status",
  };

  function validate() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setErr(COPY.required);
      return false;
    }
    return true;
  }

  async function createOrder(mode: "PAYTABS" | "COD") {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        locale,
        qty: 1,
        customer: { name, phone },
        shipping: { city, address, notes },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Order create failed");
    setCartId(data.cartId);
    setStatus(data.status);
    return data.cartId as string;
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
      if (!res.ok || !data.ok) throw new Error(data.error || "PayTabs initiate failed");
      window.location.href = data.redirect_url;
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

  const WHATSAPP_E164 = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").trim();

  const waMsg = cartId
    ? `NIVRAN / نيفـران — COD Confirmation\nCart: ${cartId}\nName: ${name}\nPhone: ${phone}\nCity: ${city}\nAddress: ${address}\nNotes: ${notes}\nTotal: ${totals.total} JOD (Shipping ${totals.shipping} JOD)\nTagline: Wear the calm. / ارتدِ الهدوء`
    : "";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>{COPY.title}</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>{COPY.subtitle}</p>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? "الاسم الكامل" : "Full name"} style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isAr ? "رقم الهاتف" : "Phone"} style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={isAr ? "المدينة" : "City"} style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={isAr ? "العنوان" : "Address"} style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isAr ? "ملاحظات (اختياري)" : "Notes (optional)"} rows={3} style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
      </div>

      {err && <p style={{ color: "crimson", marginTop: 10 }}>{err}</p>}

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>{COPY.summary}</h3>
        <p>{COPY.product}: <b>{PRICE.toFixed(2)} JOD</b></p>
        <p>{COPY.shipping}: <b>{SHIPPING.toFixed(2)} JOD</b></p>
        <p>{COPY.total}: <b>{totals.total.toFixed(2)} JOD</b></p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button
            onClick={payByCard}
            disabled={loading}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd" }}
          >
            {loading ? COPY.processing : COPY.payCard}
          </button>

          <button
            onClick={cashOnDelivery}
            disabled={loading}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd" }}
          >
            {loading ? COPY.processing : COPY.cod}
          </button>
        </div>

        {cartId && status && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, opacity: 0.8 }}>cart_id: {cartId}</div>
            <div style={{ marginTop: 6 }}>
              {COPY.status}: <b>{status}</b>
            </div>

            {status === "PENDING_COD_CONFIRM" && WHATSAPP_E164 && (
              <a
                href={waLink(WHATSAPP_E164, waMsg)}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 10, padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", textDecoration: "none" }}
              >
                {COPY.confirmWa}
              </a>
            )}

            {status === "PENDING_COD_CONFIRM" && !WHATSAPP_E164 && (
              <p style={{ fontSize: 13, opacity: 0.75, marginTop: 10 }}>
                Set <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> (E.164) to enable WhatsApp confirmation.
              </p>
            )}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 14 }}>
        NIVRAN/نيفـران uses claim-safe wording only (no medical or therapeutic claims). Keep away from heat and flame.
      </p>
    </div>
  );
}
