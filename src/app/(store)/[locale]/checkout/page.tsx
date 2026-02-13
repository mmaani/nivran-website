"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

const SHIPPING = 3.5;
const PRICE = 18.0;

function waLink(phoneE164: string, msg: string) {
  return `https://wa.me/${phoneE164}?text=${encodeURIComponent(msg)}`;
}

export default function CheckoutPage() {
  const p = useParams<{ locale?: string }>();
  const locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => ({ subtotal: PRICE, shipping: SHIPPING, total: Number((PRICE + SHIPPING).toFixed(2)) }), []);

  const COPY = {
    title: isAr ? "الدفع" : "Checkout",
    required: isAr ? "الاسم والهاتف والعنوان مطلوبة" : "Name, phone, and address are required",
    payCard: isAr ? "الدفع بالبطاقة" : "Pay by card",
    cod: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
    confirmWa: isAr ? "تأكيد عبر واتساب" : "Confirm on WhatsApp",
  };

  function validate() {
    if (!name.trim() || !phone.trim() || !address.trim() || !email.includes("@")) {
      setErr(COPY.required);
      return false;
    }
    return true;
  }

  async function createOrder(mode: "PAYTABS" | "COD") {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, locale, qty: 1, customer: { name, phone, email }, shipping: { city, address, notes } }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Order create failed");
    setCartId(data.cartId);
    setStatus(data.status);
    return data.cartId as string;
  }

  async function payByCard() {
    if (!validate()) return;
    setLoading(true); setErr(null);
    try {
      const cid = await createOrder("PAYTABS");
      const res = await fetch("/api/paytabs/initiate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cartId: cid }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "PayTabs initiate failed");
      window.location.href = data.redirectUrl || data.redirect_url;
    } catch (e: any) { setErr(e?.message || "Error"); } finally { setLoading(false); }
  }

  async function cashOnDelivery() {
    if (!validate()) return;
    setLoading(true); setErr(null);
    try { await createOrder("COD"); } catch (e: any) { setErr(e?.message || "Error"); } finally { setLoading(false); }
  }

  const waNum = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").trim();
  const waMsg = cartId ? `NIVRAN COD Confirmation\nCart: ${cartId}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nTotal: ${totals.total} JOD` : "";

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{COPY.title}</h1>
      <div className="grid-2">
        <section className="panel" style={{ display: "grid", gap: ".55rem" }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? "الاسم الكامل" : "Full name"} />
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isAr ? "رقم الهاتف" : "Phone"} />
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isAr ? "البريد الإلكتروني" : "Email"} />
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={isAr ? "المدينة" : "City"} />
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={isAr ? "العنوان" : "Address"} />
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={isAr ? "ملاحظات" : "Notes"} />
          {err && <p style={{ color: "crimson", margin: 0 }}>{err}</p>}
          <div className="cta-row">
            <button className="btn primary" onClick={payByCard} disabled={loading}>{COPY.payCard}</button>
            <button className="btn" onClick={cashOnDelivery} disabled={loading}>{COPY.cod}</button>
          </div>
        </section>

        <aside className="panel">
          <h3 style={{ marginTop: 0 }}>{isAr ? "ملخص الطلب" : "Order summary"}</h3>
          <p>{isAr ? "المنتج" : "Product"}: {PRICE.toFixed(2)} JOD</p>
          <p>{isAr ? "الشحن" : "Shipping"}: {SHIPPING.toFixed(2)} JOD</p>
          <p><strong>{isAr ? "الإجمالي" : "Total"}: {totals.total.toFixed(2)} JOD</strong></p>
          {cartId && <p style={{ marginBottom: 0, fontFamily: "monospace" }}>cart_id: {cartId} ({status})</p>}
          {status === "PENDING_COD_CONFIRM" && waNum && <a className="btn" href={waLink(waNum, waMsg)} target="_blank" rel="noreferrer">{COPY.confirmWa}</a>}
        </aside>
      </div>
    </div>
  );
}
