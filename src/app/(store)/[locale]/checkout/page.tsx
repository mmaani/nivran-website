"use client";

import { useMemo, useState } from "react";

export default function Checkout(props: any) {
  const locale = props?.params?.locale ?? "en";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // MVP demo totals (replace with real cart later)
  const order = useMemo(() => {
    const subtotal = 18; // JOD
    const shipping = Number(process.env.NEXT_PUBLIC_FLAT_SHIPPING_JOD || 3.5);
    const total = Number((subtotal + shipping).toFixed(2));
    return { subtotal, shipping, total };
  }, []);

  async function startPaytabs() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/paytabs/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          cartId: `NIVRAN-${Date.now()}`,
          cartDescription: "NIVRAN Order",
          amount: order.total,
          currency: "JOD",
          customer: {
            name: "Test Customer",
            email: "test@example.com",
            phone: "962700000000",
            street1: "Amman",
            city: "Amman",
            state: "Amman",
            country: "JO",
            zip: "11118",
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "PayTabs initiate failed");

      window.location.href = data.redirect_url;
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Checkout</h1>
      <p style={{ opacity: 0.7 }}>Locale: {locale}</p>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e5e5", borderRadius: 12, maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span><span>{order.subtotal.toFixed(2)} JOD</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span>Shipping</span><span>{order.shipping.toFixed(2)} JOD</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 700 }}>
          <span>Total</span><span>{order.total.toFixed(2)} JOD</span>
        </div>

        <button
          onClick={startPaytabs}
          disabled={loading}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Redirecting…" : "Pay with PayTabs"}
        </button>

        {err && <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>}
      </div>
    </div>
  );
}
