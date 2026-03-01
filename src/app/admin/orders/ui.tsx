"use client";

import { Fragment, useMemo, useState } from "react";
import { adminFetch } from "@/app/admin/_components/adminClient";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(obj: unknown, key: string): string {
  if (!isRecord(obj)) return "";
  const v = obj[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampMoneyJod(v: number): number {
  if (!Number.isFinite(v)) return 0;
  // 2 decimals, >=0
  return Math.max(0, Math.round(v * 100) / 100);
}

type OrderItem = {
  slug: string;
  name_en: string;
  name_ar: string;
  qty: number;
  unit_price_jod: number;
  line_total_jod: number;
};

type Row = {
  id: number;
  cart_id: string;
  status: string;
  amount: string | number;
  currency: string;
  locale: string;
  payment_method: string; // PAYTABS | COD | CARD_POS | CASH | ...
  paytabs_tran_ref: string | null;
  created_at: string;
  customer: unknown;
  shipping: unknown;
  items: unknown;
  subtotal_before_discount_jod: string | null;
  discount_jod: string | null;
  shipping_jod: string | null;
  total_jod: string | null;
  discount_source?: string | null;
  promo_code?: string | null;
  promotion_id?: string | null;
  promo_consumed?: boolean | null;
  promo_consume_failed?: boolean | null;
  promo_consume_error?: string | null;
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
  "REFUND_PENDING",
  "REFUNDED",
] as const;

const STATUS_AR: Record<string, string> = {
  PENDING_PAYMENT: "بانتظار الدفع",
  PAID: "مدفوع",
  FAILED: "فشل",
  CANCELED: "ملغي",
  PENDING_COD_CONFIRM: "بانتظار تأكيد الدفع عند الاستلام",
  PROCESSING: "قيد التجهيز",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  PAID_COD: "مدفوع (عند الاستلام)",
  REFUND_PENDING: "قيد الاسترجاع",
  REFUNDED: "تم الاسترجاع",
};

type UpdateStatusResponse = { ok?: boolean; error?: string };

// Refund API response (keep loose to avoid type churn)
type RefundResponse = { ok?: boolean; error?: string; refundId?: number | string; paytabs?: unknown };

function normalizeItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item): OrderItem | null => {
      if (!isRecord(item)) return null;
      const slug = readString(item, "slug");
      if (!slug) return null;
      return {
        slug,
        name_en: readString(item, "name_en"),
        name_ar: readString(item, "name_ar"),
        qty: Math.max(1, Math.floor(toNum(item.qty) || 1)),
        unit_price_jod: toNum(item.unit_price_jod),
        line_total_jod: toNum(item.line_total_jod),
      };
    })
    .filter((item): item is OrderItem => item !== null);
}

function isPaidStatus(status: string): boolean {
  const s = String(status || "").toUpperCase();
  return s === "PAID" || s === "PAID_COD";
}

function canRefundOrder(r: Row): boolean {
  const status = String(r.status || "").toUpperCase();
  if (!isPaidStatus(status)) return false;
  // Don’t offer refund after shipped/delivered via this quick action (you can relax later).
  // If you want to allow it later, remove this guard.
  return true;
}

export default function OrdersClient({ initialRows, lang }: { initialRows: Row[]; lang: "en" | "ar" }) {
  const isAr = lang === "ar";

  const [rows, setRows] = useState<Row[]>(Array.isArray(initialRows) ? initialRows : []);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Refund modal state
  const [refundOpenFor, setRefundOpenFor] = useState<Row | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundErr, setRefundErr] = useState<string | null>(null);
  const [refundOk, setRefundOk] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  // Hybrid: PayTabs online, Manual POS/Cash
  const [refundMode, setRefundMode] = useState<"AUTO" | "MANUAL">("AUTO");
  // Your preference: restock later (2 days) instead of immediate
  const [restockPolicy, setRestockPolicy] = useState<"DELAYED_2D" | "IMMEDIATE">("DELAYED_2D");

  const L = useMemo(() => {
    if (isAr) {
      return {
        search: "ابحث برقم السلة / الحالة / اسم العميل / الهاتف",
        noResults: "لا توجد نتائج",

        id: "المعرّف",
        cart: "السلة",
        status: "الحالة",
        payment: "الدفع",
        amount: "المبلغ",
        customer: "العميل",
        created: "التاريخ",
        details: "التفاصيل",
        update: "تحديث",

        tranRef: "tran_ref",
        hideDetails: "إخفاء",
        showDetails: "عرض",
        items: "العناصر",
        totals: "الإجماليات",

        subtotal: "المجموع قبل الخصم",
        discount: "الخصم",
        shipping: "الشحن",
        total: "الإجمالي",
        promo: "الكوبون/الترقية",
        consumed: "تم الاستخدام",
        consumeFailed: "فشل الاستخدام",
        yes: "نعم",
        no: "لا",
        dash: "—",

        refund: "استرجاع",
        refundTitle: "إنشاء عملية استرجاع",
        refundAmount: "المبلغ (JOD)",
        refundReason: "السبب",
        refundMode: "طريقة الاسترجاع",
        refundModeAuto: "PayTabs (أونلاين)",
        refundModeManual: "يدوي (POS/كاش)",
        restock: "تحديث المخزون",
        restockDelayed: "بعد يومين",
        restockImmediate: "فوراً",
        cancel: "إلغاء",
        submit: "تنفيذ",
        close: "إغلاق",
        refundedOk: "تم إرسال الاسترجاع بنجاح",
        autoNoteMissingTran: "لا يوجد tran_ref — استخدم الاسترجاع اليدوي",
        invalidAmount: "المبلغ غير صالح",
      };
    }

    return {
      search: "Search by cart_id / status / customer name / phone",
      noResults: "No results",

      id: "ID",
      cart: "Cart",
      status: "Status",
      payment: "Payment",
      amount: "Amount",
      customer: "Customer",
      created: "Created",
      details: "Details",
      update: "Update",

      tranRef: "tran_ref",
      hideDetails: "Hide",
      showDetails: "Show",
      items: "Items",
      totals: "Totals",

      subtotal: "subtotal",
      discount: "discount",
      shipping: "shipping",
      total: "total",
      promo: "promo",
      consumed: "consumed",
      consumeFailed: "consume_failed",
      yes: "yes",
      no: "no",
      dash: "—",

      refund: "Refund",
      refundTitle: "Create Refund",
      refundAmount: "Amount (JOD)",
      refundReason: "Reason",
      refundMode: "Refund mode",
      refundModeAuto: "PayTabs (online)",
      refundModeManual: "Manual (POS/Cash)",
      restock: "Restock",
      restockDelayed: "After 2 days",
      restockImmediate: "Immediately",
      cancel: "Cancel",
      submit: "Submit",
      close: "Close",
      refundedOk: "Refund request sent",
      autoNoteMissingTran: "No tran_ref — use manual refund",
      invalidAmount: "Invalid amount",
    };
  }, [isAr]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const name = readString(r.customer, "name").toLowerCase();
      const phone = readString(r.customer, "phone").toLowerCase();
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
      const res = await adminFetch("/api/admin/order-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      const raw: unknown = await res.json().catch(() => null);
      const data: UpdateStatusResponse = isRecord(raw) ? (raw as UpdateStatusResponse) : {};

      if (!res.ok || !data.ok) throw new Error(data.error || (isAr ? "فشل التحديث" : "Update failed"));

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || (isAr ? "حدث خطأ" : "Error"));
    } finally {
      setBusyId(null);
    }
  }

  function toggleDetails(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openRefund(r: Row) {
    setRefundErr(null);
    setRefundOk(null);
    setRefundOpenFor(r);

    const total = clampMoneyJod(toNum(r.total_jod ?? r.amount));
    setRefundAmount(total > 0 ? total.toFixed(2) : "");
    setRefundReason("");

    // AUTO only if PayTabs tran_ref exists; else default to MANUAL
    if (r.paytabs_tran_ref) setRefundMode("AUTO");
    else setRefundMode("MANUAL");

    setRestockPolicy("DELAYED_2D");
  }

  function closeRefund() {
    if (refundBusy) return;
    setRefundOpenFor(null);
    setRefundErr(null);
    setRefundOk(null);
    setRefundAmount("");
    setRefundReason("");
    setRefundMode("AUTO");
    setRestockPolicy("DELAYED_2D");
  }

  async function submitRefund() {
    if (!refundOpenFor) return;

    setRefundErr(null);
    setRefundOk(null);
    setRefundBusy(true);

    try {
      const amount = clampMoneyJod(Number(String(refundAmount || "").trim()));
      if (!(amount > 0)) throw new Error(L.invalidAmount);

      const wantsAuto = refundMode === "AUTO";
      if (wantsAuto && !refundOpenFor.paytabs_tran_ref) {
        throw new Error(L.autoNoteMissingTran);
      }

      // API contract: keep it flexible; backend can accept these fields.
      const payload = {
        orderId: refundOpenFor.id,
        amountJod: amount,
        reason: String(refundReason || "").trim(),
        mode: refundMode, // AUTO | MANUAL
        restockPolicy, // DELAYED_2D | IMMEDIATE
      };

      const res = await adminFetch("/api/admin/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw: unknown = await res.json().catch(() => null);
      const data: RefundResponse = isRecord(raw) ? (raw as RefundResponse) : {};

      if (!res.ok || !data.ok) {
        throw new Error(data.error || (isAr ? "فشل الاسترجاع" : "Refund failed"));
      }

      // UI: mark order as REFUND_PENDING optimistically (backend should do it anyway)
      setRows((prev) =>
        prev.map((r) => (r.id === refundOpenFor.id ? { ...r, status: "REFUND_PENDING" } : r))
      );

      setRefundOk(L.refundedOk);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setRefundErr(msg || (isAr ? "حدث خطأ" : "Error"));
    } finally {
      setRefundBusy(false);
    }
  }

  return (
    <div className="admin-grid">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} className="admin-input" />

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
              <th>{L.details}</th>
              <th>{L.update}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const cname = readString(r.customer, "name") || L.dash;
              const cphone = readString(r.customer, "phone") || L.dash;
              const customer = `${cname} / ${cphone}`;

              const amountValue = clampMoneyJod(toNum(r.total_jod ?? r.amount));
              const amount = `${Number.isFinite(amountValue) ? amountValue.toFixed(2) : "0.00"} ${r.currency}`;

              const items = normalizeItems(r.items);
              const opened = !!expanded[r.id];
              const showRefund = canRefundOrder(r);

              return (
                <Fragment key={`row-${r.id}`}>
                  <tr>
                    <td data-label={L.id} className="ltr">
                      {r.id}
                    </td>

                    <td data-label={L.cart} className="ltr">
                      {r.cart_id}
                    </td>

                    <td data-label={L.status}>
                      <b className="ltr">
                        {r.status}
                        {isAr ? ` — ${STATUS_AR[r.status] || ""}` : ""}
                      </b>
                    </td>

                    <td data-label={L.payment}>
                      <span className="ltr">{r.payment_method}</span>
                      {r.paytabs_tran_ref ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }} className="ltr">
                          {L.tranRef}: {r.paytabs_tran_ref}
                        </div>
                      ) : null}
                    </td>

                    <td data-label={L.amount} className="ltr">
                      {amount}
                    </td>

                    <td data-label={L.customer}>{customer}</td>

                    <td data-label={L.created} style={{ fontSize: 12, opacity: 0.8 }}>
                      {new Date(r.created_at).toLocaleString(isAr ? "ar-JO" : undefined)}
                    </td>

                    <td data-label={L.details} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" type="button" onClick={() => toggleDetails(r.id)}>
                        {opened ? L.hideDetails : L.showDetails}
                      </button>

                      {showRefund ? (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => openRefund(r)}
                          disabled={busyId === r.id}
                          title={L.refund}
                        >
                          {L.refund}
                        </button>
                      ) : null}
                    </td>

                    <td data-label={L.update}>
                      <select
                        value={r.status}
                        disabled={busyId === r.id}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                        className="admin-select"
                        style={{ maxWidth: 280 }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {isAr ? `${s} — ${STATUS_AR[s] || ""}` : s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  {opened ? (
                    <tr key={`details-${r.id}`} className="admin-row-details">
                      <td data-label={L.details} colSpan={9}>
                        <div className="admin-grid" style={{ gap: 8 }}>
                          <div>
                            <strong>{L.items}</strong>
                            {items.length === 0 ? (
                              <p className="admin-muted" style={{ marginTop: 4 }}>
                                {L.dash}
                              </p>
                            ) : (
                              <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
                                {items.map((item) => (
                                  <li key={`${r.id}-${item.slug}`}>
                                    <span>
                                      {isAr
                                        ? item.name_ar || item.name_en || item.slug
                                        : item.name_en || item.name_ar || item.slug}
                                    </span>
                                    <span className="mono">
                                      {" "}
                                      — {item.qty} × {item.unit_price_jod.toFixed(2)} = {item.line_total_jod.toFixed(2)} JOD
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <strong>{L.totals}</strong>
                            <div className="mono" style={{ marginTop: 4 }}>
                              {L.subtotal}: {toNum(r.subtotal_before_discount_jod).toFixed(2)} JOD • {L.discount}:{" "}
                              {toNum(r.discount_jod).toFixed(2)} JOD • {L.shipping}: {toNum(r.shipping_jod).toFixed(2)} JOD •{" "}
                              {L.total}: {toNum(r.total_jod ?? r.amount).toFixed(2)} JOD
                              <br />
                              {L.promo}: {String(r.discount_source || L.dash)}{" "}
                              {r.promo_code ? `(${r.promo_code})` : ""} {r.promotion_id ? `#${r.promotion_id}` : ""} •{" "}
                              {L.consumed}: {r.promo_consumed ? L.yes : L.no}
                              {r.promo_consume_failed
                                ? ` • ${L.consumeFailed}: ${String(r.promo_consume_error || "").trim() || L.yes}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

            {!filtered.length && (
              <tr className="admin-row-details">
                <td colSpan={9} style={{ padding: 14, opacity: 0.7 }}>
                  {L.noResults}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Refund modal (simple, no external deps) */}
      {refundOpenFor ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={(e) => {
            // close when clicking backdrop
            if (e.target === e.currentTarget) closeRefund();
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "var(--cream, #fff)",
              color: "var(--ink, #111)",
              borderRadius: 16,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{L.refundTitle}</div>
                <div className="mono" style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  #{refundOpenFor.id} • {refundOpenFor.cart_id}
                </div>
              </div>
              <button className="btn" type="button" onClick={closeRefund} disabled={refundBusy}>
                {L.close}
              </button>
            </div>

            <div className="admin-grid" style={{ gap: 10, marginTop: 12 }}>
              {refundErr ? <p style={{ color: "crimson", margin: 0 }}>{refundErr}</p> : null}
              {refundOk ? <p style={{ color: "seagreen", margin: 0 }}>{refundOk}</p> : null}

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>{L.refundAmount}</label>
                <input
                  className="admin-input ltr"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={refundBusy}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>{L.refundReason}</label>
                <input
                  className="admin-input"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={isAr ? "مثال: إرجاع العميل" : "e.g. customer return"}
                  disabled={refundBusy}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>{L.refundMode}</label>
                <select
                  className="admin-select"
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value === "MANUAL" ? "MANUAL" : "AUTO")}
                  disabled={refundBusy}
                >
                  <option value="AUTO" disabled={!refundOpenFor.paytabs_tran_ref}>
                    {L.refundModeAuto}
                  </option>
                  <option value="MANUAL">{L.refundModeManual}</option>
                </select>

                {!refundOpenFor.paytabs_tran_ref && refundMode === "AUTO" ? (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{L.autoNoteMissingTran}</div>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>{L.restock}</label>
                <select
                  className="admin-select"
                  value={restockPolicy}
                  onChange={(e) => setRestockPolicy(e.target.value === "IMMEDIATE" ? "IMMEDIATE" : "DELAYED_2D")}
                  disabled={refundBusy}
                >
                  <option value="DELAYED_2D">{L.restockDelayed}</option>
                  <option value="IMMEDIATE">{L.restockImmediate}</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button className="btn" type="button" onClick={closeRefund} disabled={refundBusy}>
                  {L.cancel}
                </button>
                <button className="btn" type="button" onClick={submitRefund} disabled={refundBusy}>
                  {refundBusy ? "…" : L.submit}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}