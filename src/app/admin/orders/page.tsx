"use client";

import { useMemo, useState } from "react";

type Order = {
  id: number;
  cart_id: string;
  status: string;
  amount: string;
  currency: string;
  locale: string;
  customer_name: string | null;
  customer_email: string | null;
  paytabs_tran_ref: string | null;
  paytabs_response_status: string | null;
  paytabs_response_message: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "REFUNDED", "FAILED"] as const;

export default function AdminOrdersPage() {
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyCart, setBusyCart] = useState<string | null>(null);

  const paid = useMemo(() => orders.filter(o => o.status === "PAID").length, [orders]);
  const pending = useMemo(() => orders.filter(o => o.status === "PENDING_PAYMENT").length, [orders]);
  const shipped = useMemo(() => orders.filter(o => o.status === "SHIPPED").length, [orders]);
  const delivered = useMemo(() => orders.filter(o => o.status === "DELIVERED").length, [orders]);
  const failed = useMemo(() => orders.filter(o => o.status === "FAILED").length, [orders]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      setOrders(data.orders || []);
    } catch (e: any) {
      setErr(e?.message || "Error");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(cartId: string, status: string) {
    setBusyCart(cartId);
    setErr(null);
    try {
      const res = await fetch("/api/admin/order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cartId, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Update failed");

      setOrders(prev =>
        prev.map(o => (o.cart_id === cartId ? { ...o, status: data.updated.status, updated_at: data.updated.updated_at } : o))
      );
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setBusyCart(null);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Admin — Orders</h1>

      <div style={{ marginTop: 10, maxWidth: 520 }}>
        <label style={{ display: "block", fontSize: 13, opacity: 0.8 }}>ADMIN_TOKEN</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste ADMIN_TOKEN here"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <button
          onClick={load}
          disabled={!token || loading}
          style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          {loading ? "Loading…" : "Load Orders"}
        </button>
        {err && <p style={{ color: "crimson" }}>{err}</p>}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px" }}>Total: {orders.length}</span>
        <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px" }}>Paid: {paid}</span>
        <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px" }}>Pending: {pending}</span>
        <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px" }}>Shipped: {shipped}</span>
        <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px" }}>Delivered: {delivered}</span>
        <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "6px 10px" }}>Failed: {failed}</span>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
          <thead>
            <tr>
              {["ID","Cart","Status","Amount","Customer","PayTabs Ref","PayTabs Status","Created","Actions"].map(h => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "10px 8px", fontSize: 13, opacity: 0.8 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{o.id}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2", fontFamily: "monospace" }}>{o.cart_id}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{o.status}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>{Number(o.amount).toFixed(2)} {o.currency}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                  {(o.customer_name || "—")}<br/>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{o.customer_email || ""}</span>
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2", fontFamily: "monospace" }}>{o.paytabs_tran_ref || "—"}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                  {(o.paytabs_response_status || "—")}<br/>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>{o.paytabs_response_message || ""}</span>
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2", fontSize: 13 }}>
                  {new Date(o.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f2f2f2" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setStatus(o.cart_id, "SHIPPED")}
                      disabled={!token || busyCart === o.cart_id}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      Mark Shipped
                    </button>
                    <button
                      onClick={() => setStatus(o.cart_id, "DELIVERED")}
                      disabled={!token || busyCart === o.cart_id}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      Mark Delivered
                    </button>
                    <select
                      value={o.status}
                      onChange={(e) => setStatus(o.cart_id, e.target.value)}
                      disabled={!token || busyCart === o.cart_id}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr><td colSpan={9} style={{ padding: 16, opacity: 0.7 }}>No orders loaded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
