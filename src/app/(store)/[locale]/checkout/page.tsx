"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { params: Promise<{ locale: string }> };

type Order = {
  cart_id: string;
  status: string;
  amount: number;
  currency: string;
  paytabs_tran_ref: string | null;
  paytabs_response_status: string | null;
  paytabs_response_message: string | null;
  updated_at: string;
};

function pillStyle() {
  return { display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd" } as const;
}

export default function CheckoutPage({ params }: Props) {
  const [locale, setLocale] = useState("en");

  const [cartId, setCartId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setLocale(p?.locale || "en"));
  }, [params]);

  useEffect(() => {
    const u = new URL(window.location.href);
    setResult(u.searchParams.get("result"));
    setCartId(u.searchParams.get("cart_id"));
  }, []);

  async function fetchStatus() {
    if (!cartId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/order-status?cart_id=${encodeURIComponent(cartId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      setOrder(data.order);
    } catch (e: any) {
      setErr(e?.message || "Error");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch when returning from PayTabs
  useEffect(() => {
    if (result === "paytabs" && cartId) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, cartId]);

  const heading = useMemo(() => {
    if (result !== "paytabs") return "Checkout";
    if (!order) return "Checkout";
    if (order.status === "PAID") return "Payment successful";
    if (order.status === "FAILED") return "Payment failed";
    return "Payment pending";
  }, [result, order]);

  const statusBadge = useMemo(() => {
    if (!order) return null;
    const s = String(order.status || "");
    return (
      <span style={pillStyle()}>
        <b>Status:</b> <span style={{ fontFamily: "monospace" }}>{s}</span>
      </span>
    );
  }, [order]);

  // Dummy totals for MVP (keep your existing numbers)
  const subtotal = 18.0;
  const shipping = 3.5;
  const total = subtotal + shipping;

  function retryLink() {
    // In your MVP, “retry” can simply reload checkout and click PayTabs again.
    // If you later implement "initiate" to reuse cart_id, we can wire it.
    return `/${locale}/checkout`;
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>{heading}</h1>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: 0.85 }}>
        <span style={pillStyle()}>Locale: <b>{locale}</b></span>
        {cartId && <span style={pillStyle()}><b>cart_id:</b> <span style={{ fontFamily: "monospace" }}>{cartId}</span></span>}
        {statusBadge}
      </div>

      {result === "paytabs" && (
        <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          {loading && <p style={{ margin: 0 }}>Checking payment status…</p>}
          {err && <p style={{ margin: 0, color: "crimson" }}>{err}</p>}

          {!loading && !err && order && (
            <>
              <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={pillStyle()}>
                  <b>Total:</b> {Number(order.amount ?? total).toFixed(2)} {order.currency || "JOD"}
                </span>
                <span style={pillStyle()}>
                  <b>PayTabs:</b>{" "}
                  <span style={{ fontFamily: "monospace" }}>{order.paytabs_tran_ref || "—"}</span>
                </span>
                <span style={pillStyle()}>
                  <b>Response:</b>{" "}
                  <span style={{ fontFamily: "monospace" }}>{order.paytabs_response_status || "—"}</span>{" "}
                  {order.paytabs_response_message ? `(${order.paytabs_response_message})` : ""}
                </span>
              </div>

              {order.status === "PAID" && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: "1px solid #d7f2dd" }}>
                  <b>Order confirmed.</b> Thank you — Wear the calm.
                </div>
              )}

              {order.status !== "PAID" && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: "1px solid #f2d7d7" }}>
                  <b>Not completed.</b> If you cancelled, that’s okay — you can try again.
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={fetchStatus}
                      disabled={loading}
                      style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd" }}
                    >
                      Refresh status
                    </button>
                    <a
                      href={retryLink()}
                      style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", textDecoration: "none", display: "inline-block" }}
                    >
                      Retry payment
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !err && !order && (
            <div style={{ marginTop: 6 }}>
              <p style={{ marginTop: 0 }}>We couldn’t load your order yet.</p>
              <button
                onClick={fetchStatus}
                disabled={!cartId || loading}
                style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd" }}
              >
                Refresh status
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Subtotal</h3>
        <p>{subtotal.toFixed(2)} JOD</p>
        <h3>Shipping</h3>
        <p>{shipping.toFixed(2)} JOD</p>
        <h3>Total</h3>
        <p><b>{total.toFixed(2)} JOD</b></p>

        <div style={{ marginTop: 12 }}>
          <button style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd" }}>
            Pay with PayTabs
          </button>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
            (Your existing PayTabs initiate button/flow stays here — this page now just shows the result cleanly after return.)
          </p>
        </div>
      </div>
    </div>
  );
}
