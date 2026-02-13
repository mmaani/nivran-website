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
};

export default function CheckoutPage({ params }: Props) {
  const [locale, setLocale] = useState("en");
  const [cartId, setCartId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setLocale(p.locale || "en"));
  }, [params]);

  useEffect(() => {
    const u = new URL(window.location.href);
    setResult(u.searchParams.get("result"));
    setCartId(u.searchParams.get("cart_id"));
  }, []);

  async function refresh() {
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

  useEffect(() => {
    if (result === "paytabs" && cartId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, cartId]);

  const title = useMemo(() => {
    if (!result) return "Checkout";
    if (!order) return "Checkout";
    if (order.status === "PAID") return "Payment successful";
    if (order.status === "FAILED") return "Payment failed";
    return "Payment pending";
  }, [result, order]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760, margin: "0 auto" }}>
      <h1>{title}</h1>
      <p style={{ opacity: 0.75 }}>Locale: {locale}</p>

      {result === "paytabs" && cartId && (
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, marginTop: 12 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, opacity: 0.8 }}>cart_id: {cartId}</div>

          {loading && <p>Checking payment status…</p>}
          {err && <p style={{ color: "crimson" }}>{err}</p>}

          {order && (
            <>
              <p style={{ marginTop: 8 }}>
                Status: <b>{order.status}</b>
              </p>
              <p>
                Total: <b>{Number(order.amount).toFixed(2)} {order.currency}</b>
              </p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>
                PayTabs: {order.paytabs_tran_ref || "—"} / {order.paytabs_response_status || "—"} {order.paytabs_response_message ? `(${order.paytabs_response_message})` : ""}
              </p>

              {order.status === "PAID" && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #d7f2dd" }}>
                  <b>Thank you.</b> Your order is confirmed. Wear the calm.
                </div>
              )}

              {order.status === "FAILED" && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #f2d7d7" }}>
                  <b>Payment didn’t complete.</b> You can try again from checkout.
                </div>
              )}
            </>
          )}

          <button
            onClick={refresh}
            disabled={!cartId || loading}
            style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            Refresh status
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Subtotal</h3>
        <p>18.00 JOD</p>
        <h3>Shipping</h3>
        <p>3.50 JOD</p>
        <h3>Total</h3>
        <p><b>21.50 JOD</b></p>
        <p style={{ fontSize: 13, opacity: 0.75 }}>Checkout UI + PayTabs flow goes here.</p>
      </div>
    </div>
  );
}
