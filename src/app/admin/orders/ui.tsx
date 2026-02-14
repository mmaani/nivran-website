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

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

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
] as const;

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  PENDING_PAYMENT: { en: "Pending Payment", ar: "بانتظار الدفع" },
  PAID: { en: "Paid", ar: "مدفوع" },
  FAILED: { en: "Failed", ar: "فشل" },
  CANCELED: { en: "Canceled", ar: "ملغي" },
  PENDING_COD_CONFIRM: { en: "COD: Pending Confirm", ar: "دفع عند الاستلام: انتظار التأكيد" },
  PROCESSING: { en: "Processing", ar: "قيد المعالجة" },
  SHIPPED: { en: "Shipped", ar: "تم الشحن" },
  DELIVERED: { en: "Delivered", ar: "تم التسليم" },
  PAID_COD: { en: "COD: Paid", ar: "دفع عند الاستلام: مدفوع" },
};

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
        credentials: "include",
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Update failed");

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 14 }}>
      <div className="admin-grid">
        <div>
          <div className="admin-label" style={{ marginBottom: 6 }}>
            <T en="Search" ar="بحث" />
          </div>
          <input
            className="admin-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="cart_id / status / name / phone"
          />
        </div>

        {err && (
          <p style={{ margin: 0, color: "crimson" }}>
            <T en="Error: " ar="خطأ: " />
            {err}
          </p>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><T en="ID" ar="المعرف" /></th>
                <th><T en="Cart" ar="السلة" /></th>
                <th><T en="Status" ar="الحالة" /></th>
                <th><T en="Payment" ar="الدفع" /></th>
                <th><T en="Amount" ar="المبلغ" /></th>
                <th><T en="Customer" ar="العميل" /></th>
                <th><T en="Created" ar="تاريخ الإنشاء" /></th>
                <th><T en="Update" ar="تحديث" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const customer = `${r.customer?.name || "-"} / ${r.customer?.phone || "-"}`;
                const amount = `${Number(r.amount).toFixed(2)} ${r.currency}`;
                const label = STATUS_LABELS[r.status]?.en || r.status;
                const labelAr = STATUS_LABELS[r.status]?.ar || r.status;

                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td className="mono">{r.cart_id}</td>

                    <td>
                      <b>{r.status}</b>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                        <span className="t-en">{label}</span>
                        <span className="t-ar">{labelAr}</span>
                      </div>
                    </td>

                    <td>
                      {r.payment_method}
                      {r.paytabs_tran_ref ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>tran_ref: {r.paytabs_tran_ref}</div>
                      ) : null}
                    </td>

                    <td>{amount}</td>
                    <td>{customer}</td>
                    <td style={{ fontSize: 12, opacity: 0.8 }}>{new Date(r.created_at).toLocaleString()}</td>

                    <td>
                      <select
                        className="admin-select"
                        value={r.status}
                        disabled={busyId === r.id}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s} — {STATUS_LABELS[s]?.en || ""} / {STATUS_LABELS[s]?.ar || ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 14, opacity: 0.7 }}>
                    <T en="No results" ar="لا توجد نتائج" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
