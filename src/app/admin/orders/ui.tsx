"use client";

import { useMemo, useState } from "react";

type Row = {
  id: number;
  cart_id: string;
  status: string;
  amount: string | number;
  currency: string;
  locale: string;
  payment_method: string;
  paytabs_tran_ref: string | null;
  created_at: string;
  customer: any;
  shipping: any;
};

const STATUS_OPTIONS = [
  "PENDING_PAYMENT",
  "PAID",
  "FAILED",
  "CANCELED",

  "PENDING_COD_CONFIRM",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "PAID_COD",
];

export default function OrdersClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows || []);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const name = String(r.customer?.name || "").toLowerCase();
      const phone = String(r.customer?.phone || "").toLowerCase();
      return (
        String(r.cart_id).toLowerCase().includes(s) ||
        String(r.status).toLowerCase().includes(s) ||
        name.includes(s) ||
        phone.includes(s)
      );
    });
  }, [rows, q]);

  async function updateStatus(id: number, nextStatus: string) {
    setErr(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/order-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Update failed");

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by cart_id / status / customer name / phone"
        style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
      />
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <div style={{ overflowX: "auto", marginTop: 12, border: "1px solid #eee", borderRadius: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>ID</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Cart</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Status</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Payment</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Amount</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Customer</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Created</th>
              <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Update</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const customer = `${r.customer?.name || "-"} / ${r.customer?.phone || "-"}`;
              const amount = `${Number(r.amount).toFixed(2)} ${r.currency}`;
              return (
                <tr key={r.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{r.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2", fontFamily: "monospace", fontSize: 12 }}>{r.cart_id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}><b>{r.status}</b></td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                    {r.payment_method}{r.paytabs_tran_ref ? <div style={{ fontSize: 12, opacity: 0.7 }}>tran_ref: {r.paytabs_tran_ref}</div> : null}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{amount}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{customer}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2", fontSize: 12, opacity: 0.8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                    <select
                      defaultValue={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={8} style={{ padding: 14, opacity: 0.7 }}>No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
