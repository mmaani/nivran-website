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

const STATUS_AR: Record<string, string> = {
  PENDING_PAYMENT: "بانتظار الدفع",
  PAID: "مدفوع",
  FAILED: "فشل",
  CANCELED: "ملغي",
  PENDING_COD_CONFIRM: "بانتظار تأكيد COD",
  PROCESSING: "قيد التجهيز",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  PAID_COD: "مدفوع (COD)",
};

export default function OrdersClient({ initialRows, lang }: { initialRows: Row[]; lang: "en" | "ar" }) {
  const [rows, setRows] = useState<Row[]>(initialRows || []);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const L = useMemo(() => {
    if (lang === "ar") {
      return {
        search: "ابحث برقم السلة / الحالة / اسم العميل / الهاتف",
        id: "المعرّف",
        cart: "السلة",
        status: "الحالة",
        payment: "الدفع",
        amount: "المبلغ",
        customer: "العميل",
        created: "التاريخ",
        update: "تحديث",
        noResults: "لا توجد نتائج",
        tranRef: "tran_ref",
      };
    }
    return {
      search: "Search by cart_id / status / customer name / phone",
      id: "ID",
      cart: "Cart",
      status: "Status",
      payment: "Payment",
      amount: "Amount",
      customer: "Customer",
      created: "Created",
      update: "Update",
      noResults: "No results",
      tranRef: "tran_ref",
    };
  }, [lang]);

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
    <div className="admin-grid">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={L.search}
        className="admin-input"
      />

      {err && <p style={{ color: "crimson", margin: 0 }}>{err}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{L.id}</th>
              <th>{L.cart}</th>
              <th>{L.status}</th>
              <th>{L.payment}</th>
              <th>{L.amount}</th>
              <th>{L.customer}</th>
              <th>{L.created}</th>
              <th>{L.update}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const customer = `${r.customer?.name || "-"} / ${r.customer?.phone || "-"}`;
              const amount = `${Number(r.amount).toFixed(2)} ${r.currency}`;
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td className="ltr">{r.cart_id}</td>
                  <td>
                    <b className="ltr">
                      {r.status}
                      {lang === "ar" ? ` — ${STATUS_AR[r.status] || ""}` : ""}
                    </b>
                  </td>
                  <td>
                    <span className="ltr">{r.payment_method}</span>
                    {r.paytabs_tran_ref ? (
                      <div style={{ fontSize: 12, opacity: 0.7 }} className="ltr">
                        {L.tranRef}: {r.paytabs_tran_ref}
                      </div>
                    ) : null}
                  </td>
                  <td className="ltr">{amount}</td>
                  <td>{customer}</td>
                  <td style={{ fontSize: 12, opacity: 0.8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    <select
                      defaultValue={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className="admin-select"
                      style={{ maxWidth: 280 }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {lang === "ar" ? `${s} — ${STATUS_AR[s] || ""}` : s}
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
                  {L.noResults}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
