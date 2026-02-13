"use client";

import { useEffect, useMemo, useState } from "react";

export default function PayResultPage({ params, searchParams }: any) {
  const locale = (params?.locale === "ar" ? "ar" : "en") as "ar" | "en";
  const isAr = locale === "ar";
  const cartId = String(searchParams?.cart_id || "");

  const [status, setStatus] = useState<string>("...");
  const [method, setMethod] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const labels = useMemo(() => {
    return isAr
      ? {
          title: "حالة الدفع",
          note: "التحقق النهائي يتم عبر ردّ السيرفر (Callback) من PayTabs.",
          cart: "رقم السلة",
          current: "الحالة الحالية",
          refresh: "تحديث",
        }
      : {
          title: "Payment status",
          note: "Final confirmation is based on the PayTabs server callback (not the return redirect).",
          cart: "Cart ID",
          current: "Current status",
          refresh: "Refresh",
        };
  }, [isAr]);

  async function load() {
    setErr("");
    try {
      const res = await fetch(`/api/orders/status?cartId=${encodeURIComponent(cartId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      setStatus(String(data.order?.status || ""));
      setMethod(String(data.order?.payment_method || ""));
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  useEffect(() => {
    if (!cartId) return;
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 18, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>{labels.title}</h1>
      <p style={{ opacity: 0.75 }}>{labels.note}</p>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div><b>{labels.cart}:</b> <span style={{ fontFamily: "monospace" }}>{cartId || "—"}</span></div>
        <div style={{ marginTop: 8 }}><b>{labels.current}:</b> {status} {method ? `(${method})` : ""}</div>
        {err ? <div style={{ marginTop: 8, color: "crimson" }}>{err}</div> : null}

        <button onClick={load} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          {labels.refresh}
        </button>
      </div>
    </div>
  );
}
