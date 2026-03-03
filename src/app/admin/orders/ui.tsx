"use client";

import { Fragment, useCallback, useMemo, useState, type CSSProperties } from "react";
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
  sales_actor_role?: string | null;
  sales_actor_staff_id?: number | null;
  sales_actor_username?: string | null;
  sales_created_at?: string | null;
  last_refund_id?: number | null;
  last_refund_status?: string | null;
  last_refund_method?: string | null;
  last_refund_amount_jod?: string | null;
  last_refund_requested_at?: string | null;
  last_refund_succeeded_at?: string | null;
  last_refund_failed_at?: string | null;
  last_refund_error?: string | null;
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
  "REFUND_REQUESTED",
  "REFUND_PENDING",
  "REFUND_FAILED",
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
  REFUND_REQUESTED: "طلب استرجاع",
  REFUND_PENDING: "قيد الاسترجاع",
  REFUND_FAILED: "فشل الاسترجاع",
  REFUNDED: "تم الاسترجاع",
};

type UpdateStatusResponse = { ok?: boolean; error?: string };

// Refund API response (keep loose to avoid type churn)
type RefundResponse = { ok?: boolean; error?: string; refundId?: number | string; paytabs?: unknown };

type QuickFilter = "ALL" | "REFUND_ACTIVE" | "REFUND_FAILED" | "PAYTABS" | "MANUAL_ACTION";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["PAID", "FAILED", "CANCELED"],
  PAID: ["PROCESSING", "REFUND_REQUESTED", "REFUND_PENDING"],
  PROCESSING: ["SHIPPED", "REFUND_REQUESTED", "REFUND_PENDING"],
  SHIPPED: ["DELIVERED", "REFUND_REQUESTED", "REFUND_PENDING"],
  DELIVERED: ["REFUND_REQUESTED", "REFUND_PENDING"],
  FAILED: [],
  CANCELED: [],
  PENDING_COD_CONFIRM: ["PAID_COD", "CANCELED"],
  PAID_COD: ["PROCESSING", "REFUND_REQUESTED", "REFUND_PENDING"],
  REFUND_REQUESTED: ["REFUND_PENDING", "REFUND_FAILED", "REFUNDED"],
  REFUND_PENDING: ["REFUND_FAILED", "REFUNDED"],
  REFUND_FAILED: [],
  REFUNDED: [],
};

function parseRefundId(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}

function statusBadgeStyle(status: string): CSSProperties {
  const s = String(status || "").toUpperCase();
  if (s === "PAID" || s === "PAID_COD" || s === "DELIVERED" || s === "REFUNDED") {
    return { background: "#eaf9ef", color: "#1f7a3f", border: "1px solid #bfe7cd" };
  }
  if (s.startsWith("REFUND_")) {
    return { background: "#fff4e8", color: "#9a4d00", border: "1px solid #ffd1a8" };
  }
  if (s === "FAILED" || s === "CANCELED") {
    return { background: "#ffecec", color: "#a12626", border: "1px solid #ffc4c4" };
  }
  if (s === "PENDING_PAYMENT" || s === "PENDING_COD_CONFIRM" || s === "PROCESSING" || s === "SHIPPED") {
    return { background: "#eef5ff", color: "#1f4a86", border: "1px solid #c9dcff" };
  }
  return { background: "#f6f6f6", color: "#444", border: "1px solid #ddd" };
}

function sourceBadgeStyle(source: "ONLINE" | "SALES" | "LEGACY_SALES"): CSSProperties {
  if (source === "SALES") return { background: "#eaf4ff", color: "#184e96", border: "1px solid #b8d3ff" };
  if (source === "LEGACY_SALES") return { background: "#f4f1ff", color: "#52379b", border: "1px solid #d7cbff" };
  return { background: "#ecf9ef", color: "#1f6b3c", border: "1px solid #bfe7cd" };
}

function promoBadgeStyle(hasPromo: boolean): CSSProperties {
  if (!hasPromo) return { background: "#f4f4f4", color: "#555", border: "1px solid #ddd" };
  return { background: "#fff4dc", color: "#8d5600", border: "1px solid #f4d39a" };
}

function allowsTransition(current: string, next: string): boolean {
  const cur = String(current || "").toUpperCase();
  const nxt = String(next || "").toUpperCase();
  if (!cur || !nxt) return false;
  if (cur === nxt) return true;
  return (ALLOWED_TRANSITIONS[cur] || []).includes(nxt);
}

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
  return isPaidStatus(status);
}

function genIdempotencyKey(orderId: number): string {
  const t = Date.now();
  const rand =
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  return `refund-${orderId}-${t}-${rand}`;
}

export default function OrdersClient({ initialRows, lang }: { initialRows: Row[]; lang: "en" | "ar" }) {
  const isAr = lang === "ar";

  const [rows, setRows] = useState<Row[]>(Array.isArray(initialRows) ? initialRows : []);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");

  // Track latest refundId per order (so we can confirm/fail manual refunds without changing orders API)
  const [refundIdByOrder, setRefundIdByOrder] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    for (const row of initialRows) {
      const rid = parseRefundId(row.last_refund_id);
      if (rid > 0) map[row.id] = rid;
    }
    return map;
  });

  // Refund modal state
  const [refundOpenFor, setRefundOpenFor] = useState<Row | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundErr, setRefundErr] = useState<string | null>(null);
  const [refundOk, setRefundOk] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  // Hybrid: PayTabs online, Manual POS/Cash
  const [refundMode, setRefundMode] = useState<"AUTO" | "MANUAL">("AUTO");

  // Policy locked: restock after 2 days (no immediate)
  const restockPolicyLocked = "DELAYED_2D" as const;

  const currentRefundIdForOrder = useCallback(
    (orderId: number): number => {
      const fromMap = refundIdByOrder[orderId] || 0;
      if (fromMap > 0) return fromMap;
      const row = rows.find((r) => r.id === orderId);
      return row ? parseRefundId(row.last_refund_id) : 0;
    },
    [refundIdByOrder, rows]
  );

  const L = useMemo(() => {
    if (isAr) {
      return {
        search: "ابحث برقم السلة / الحالة / اسم العميل / الهاتف",
        noResults: "لا توجد نتائج",
        all: "الكل",
        refundActive: "استرجاع نشط",
        refundFailed: "استرجاع فاشل",
        paytabs: "PayTabs",
        manualAction: "إجراء يدوي",

        id: "المعرّف",
        cart: "السلة",
        status: "الحالة",
        payment: "الدفع",
        source: "القناة",
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
        promoApplied: "تم تطبيق عرض",
        consumed: "تم الاستخدام",
        consumeFailed: "فشل الاستخدام",
        online: "المتجر الإلكتروني",
        salesDesk: "مبيعات مباشرة",
        salesDeskLegacy: "مبيعات (قديم)",
        by: "بواسطة",
        unknownSalesUser: "موظف غير معروف",
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
        restockNote: "المخزون سيتم تحديثه تلقائياً بعد يومين (48 ساعة).",
        cancel: "إلغاء",
        submit: "تنفيذ",
        close: "إغلاق",
        refundedOk: "تم إنشاء طلب الاسترجاع",
        autoNoteMissingTran: "لا يوجد tran_ref — استخدم الاسترجاع اليدوي",
        invalidAmount: "المبلغ غير صالح",

        confirmManual: "تأكيد يدوي",
        failManual: "فشل يدوي",
        refundState: "حالة الاسترجاع",
      };
    }

    return {
      search: "Search by cart_id / status / customer name / phone",
      noResults: "No results",
      all: "All",
      refundActive: "Refund active",
      refundFailed: "Refund failed",
      paytabs: "PayTabs",
      manualAction: "Manual action",

      id: "ID",
      cart: "Cart",
      status: "Status",
      payment: "Payment",
      source: "Source",
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
      promoApplied: "Promo applied",
      consumed: "consumed",
      consumeFailed: "consume_failed",
      online: "Online store",
      salesDesk: "Sales desk",
      salesDeskLegacy: "Sales (legacy)",
      by: "by",
      unknownSalesUser: "Unknown salesperson",
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
      restockNote: "Inventory will be restocked automatically after 2 days (48 hours).",
      cancel: "Cancel",
      submit: "Submit",
      close: "Close",
      refundedOk: "Refund request created",
      autoNoteMissingTran: "No tran_ref — use manual refund",
      invalidAmount: "Invalid amount",

      confirmManual: "Confirm manual",
      failManual: "Fail manual",
      refundState: "Refund state",
    };
  }, [isAr]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const bySearch = rows.filter((r) => {
      const name = readString(r.customer, "name").toLowerCase();
      const phone = readString(r.customer, "phone").toLowerCase();
      const salesUser = String(r.sales_actor_username || "").toLowerCase();
      const promo = String(r.promo_code || "").toLowerCase();
      const matchesSearch =
        String(r.cart_id).toLowerCase().includes(s) ||
        String(r.status).toLowerCase().includes(s) ||
        name.includes(s) ||
        phone.includes(s) ||
        salesUser.includes(s) ||
        promo.includes(s);
      if (!s) return true;
      return matchesSearch;
    });

    return bySearch.filter((r) => {
      const statusUpper = String(r.status || "").toUpperCase();
      const paymentUpper = String(r.payment_method || "").toUpperCase();
      const lastRefundStatus = String(r.last_refund_status || "").toUpperCase();
      const canManual =
        paymentUpper !== "PAYTABS" &&
        currentRefundIdForOrder(r.id) > 0 &&
        (statusUpper === "REFUND_PENDING" || lastRefundStatus === "REQUESTED" || lastRefundStatus === "FAILED");

      if (quickFilter === "ALL") return true;
      if (quickFilter === "REFUND_ACTIVE") return statusUpper === "REFUND_PENDING" || statusUpper === "REFUND_REQUESTED";
      if (quickFilter === "REFUND_FAILED") return statusUpper === "REFUND_FAILED" || lastRefundStatus === "FAILED";
      if (quickFilter === "PAYTABS") return paymentUpper === "PAYTABS";
      if (quickFilter === "MANUAL_ACTION") return canManual;
      return true;
    });
  }, [rows, q, quickFilter, currentRefundIdForOrder]);

  const counts = useMemo(() => {
    const c = { all: rows.length, refundActive: 0, refundFailed: 0, paytabs: 0, manualAction: 0 };
    for (const r of rows) {
      const statusUpper = String(r.status || "").toUpperCase();
      const paymentUpper = String(r.payment_method || "").toUpperCase();
      const lastRefundStatus = String(r.last_refund_status || "").toUpperCase();
      if (statusUpper === "REFUND_PENDING" || statusUpper === "REFUND_REQUESTED") c.refundActive += 1;
      if (statusUpper === "REFUND_FAILED" || lastRefundStatus === "FAILED") c.refundFailed += 1;
      if (paymentUpper === "PAYTABS") c.paytabs += 1;
      const canManual =
        paymentUpper !== "PAYTABS" &&
        currentRefundIdForOrder(r.id) > 0 &&
        (statusUpper === "REFUND_PENDING" || lastRefundStatus === "REQUESTED" || lastRefundStatus === "FAILED");
      if (canManual) c.manualAction += 1;
    }
    return c;
  }, [rows, currentRefundIdForOrder]);

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
  }

  function closeRefund() {
    if (refundBusy) return;
    setRefundOpenFor(null);
    setRefundErr(null);
    setRefundOk(null);
    setRefundAmount("");
    setRefundReason("");
    setRefundMode("AUTO");
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

      const payload = {
        orderId: refundOpenFor.id,
        amountJod: amount,
        reason: String(refundReason || "").trim(),
        mode: refundMode, // AUTO | MANUAL
        idempotencyKey: genIdempotencyKey(refundOpenFor.id),
        restockPolicy: restockPolicyLocked, // backend can ignore; policy is locked here
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

      // Store refundId for later manual confirm/fail actions
      const refundIdNum = parseRefundId(data.refundId);

      if (refundIdNum > 0) {
        setRefundIdByOrder((prev) => ({ ...prev, [refundOpenFor.id]: refundIdNum }));
      }

      // UI: mark order as REFUND_PENDING optimistically
      setRows((prev) =>
        prev.map((r) =>
          r.id === refundOpenFor.id
            ? {
                ...r,
                status: "REFUND_PENDING",
                last_refund_id: refundIdNum > 0 ? refundIdNum : r.last_refund_id ?? null,
                last_refund_status: "REQUESTED",
                last_refund_method: refundMode === "AUTO" ? "PAYTABS" : "MANUAL",
                last_refund_amount_jod: amount.toFixed(2),
                last_refund_requested_at: new Date().toISOString(),
                last_refund_error: null,
              }
            : r
        )
      );

      setRefundOk(L.refundedOk);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setRefundErr(msg || (isAr ? "حدث خطأ" : "Error"));
    } finally {
      setRefundBusy(false);
    }
  }

  async function confirmManualRefund(orderId: number) {
    const refundId = currentRefundIdForOrder(orderId);
    if (!(refundId > 0)) {
      setErr(isAr ? "لا يوجد refundId لهذا الطلب. أنشئ الاسترجاع أولاً." : "No refundId for this order. Create a refund first.");
      return;
    }

    setErr(null);
    setBusyId(orderId);

    try {
      const res = await adminFetch("/api/admin/refund/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refundId, note: "confirmed in admin" }),
      });

      const raw: unknown = await res.json().catch(() => null);
      const ok = isRecord(raw) && raw["ok"] === true;

      if (!res.ok || !ok) {
        const msg = isRecord(raw) ? String(raw["error"] || "") : "";
        throw new Error(msg || (isAr ? "فشل تأكيد الاسترجاع" : "Confirm refund failed"));
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === orderId
            ? { ...r, status: "REFUNDED", last_refund_status: "RESTOCK_SCHEDULED", last_refund_succeeded_at: new Date().toISOString() }
            : r
        )
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || (isAr ? "حدث خطأ" : "Error"));
    } finally {
      setBusyId(null);
    }
  }

  async function failManualRefund(orderId: number) {
    const refundId = currentRefundIdForOrder(orderId);
    if (!(refundId > 0)) {
      setErr(isAr ? "لا يوجد refundId لهذا الطلب. أنشئ الاسترجاع أولاً." : "No refundId for this order. Create a refund first.");
      return;
    }

    setErr(null);
    setBusyId(orderId);

    try {
      const res = await adminFetch("/api/admin/refund/fail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refundId, message: "manual refund failed in admin" }),
      });

      const raw: unknown = await res.json().catch(() => null);
      const ok = isRecord(raw) && raw["ok"] === true;

      if (!res.ok || !ok) {
        const msg = isRecord(raw) ? String(raw["error"] || "") : "";
        throw new Error(msg || (isAr ? "فشل تحديث حالة الاسترجاع" : "Mark refund failed"));
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === orderId
            ? {
                ...r,
                status: "REFUND_FAILED",
                last_refund_status: "FAILED",
                last_refund_failed_at: new Date().toISOString(),
                last_refund_error: "manual refund failed in admin",
              }
            : r
        )
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || (isAr ? "حدث خطأ" : "Error"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-grid">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} className="admin-input" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => setQuickFilter("ALL")} disabled={quickFilter === "ALL"}>
          {L.all} ({counts.all})
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setQuickFilter("REFUND_ACTIVE")}
          disabled={quickFilter === "REFUND_ACTIVE"}
        >
          {L.refundActive} ({counts.refundActive})
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setQuickFilter("REFUND_FAILED")}
          disabled={quickFilter === "REFUND_FAILED"}
        >
          {L.refundFailed} ({counts.refundFailed})
        </button>
        <button className="btn" type="button" onClick={() => setQuickFilter("PAYTABS")} disabled={quickFilter === "PAYTABS"}>
          {L.paytabs} ({counts.paytabs})
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setQuickFilter("MANUAL_ACTION")}
          disabled={quickFilter === "MANUAL_ACTION"}
        >
          {L.manualAction} ({counts.manualAction})
        </button>
      </div>

      {err && <p style={{ color: "crimson", margin: 0 }}>{err}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{L.id}</th>
              <th>{L.cart}</th>
              <th>{L.status}</th>
              <th>{L.payment}</th>
              <th>{L.source}</th>
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

              const statusUpper = String(r.status || "").toUpperCase();
              const paymentUpper = String(r.payment_method || "").toUpperCase();
              const hasSalesAudit = !!String(r.sales_actor_role || "").trim();
              const legacySales = !hasSalesAudit && String(r.cart_id || "").toLowerCase().startsWith("sales_");
              const sourceKind: "ONLINE" | "SALES" | "LEGACY_SALES" = hasSalesAudit ? "SALES" : legacySales ? "LEGACY_SALES" : "ONLINE";
              const sourceLabel = sourceKind === "SALES" ? L.salesDesk : sourceKind === "LEGACY_SALES" ? L.salesDeskLegacy : L.online;
              const salesUser = String(r.sales_actor_username || "").trim() || L.unknownSalesUser;
              const salesStaffId =
                typeof r.sales_actor_staff_id === "number" && Number.isFinite(r.sales_actor_staff_id) && r.sales_actor_staff_id > 0
                  ? `#${Math.trunc(r.sales_actor_staff_id)}`
                  : "";
              const hasPromo = String(r.discount_source || "").toUpperCase() === "AUTO" || String(r.discount_source || "").toUpperCase() === "CODE";
              const promoLabel = hasPromo
                ? `${String(r.discount_source || "").toUpperCase()}${r.promo_code ? `:${String(r.promo_code).trim()}` : ""}`
                : L.dash;
              const currentRefundId = currentRefundIdForOrder(r.id);
              const lastRefundStatus = String(r.last_refund_status || "").toUpperCase();
              const canConfirmManual =
                paymentUpper !== "PAYTABS" &&
                currentRefundId > 0 &&
                (statusUpper === "REFUND_PENDING" || lastRefundStatus === "REQUESTED" || lastRefundStatus === "FAILED");
              const refundStateLabel = String(r.last_refund_status || r.status || "").toUpperCase() || L.dash;

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
                      <span
                        className="ltr"
                        style={{
                          ...statusBadgeStyle(r.status),
                          padding: "3px 8px",
                          borderRadius: 999,
                          display: "inline-block",
                          fontWeight: 700,
                        }}
                      >
                        {r.status}
                      </span>
                      {isAr ? <div style={{ fontSize: 12, opacity: 0.8 }}>{STATUS_AR[r.status] || ""}</div> : null}
                    </td>

                    <td data-label={L.payment}>
                      <span className="ltr">{r.payment_method}</span>
                      {r.paytabs_tran_ref ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }} className="ltr">
                          {L.tranRef}: {r.paytabs_tran_ref}
                        </div>
                      ) : null}
                    </td>

                    <td data-label={L.source}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span
                          style={{
                            ...sourceBadgeStyle(sourceKind),
                            padding: "2px 10px",
                            borderRadius: 999,
                            display: "inline-block",
                            fontSize: 12,
                            fontWeight: 700,
                            width: "fit-content",
                          }}
                        >
                          {sourceLabel}
                        </span>
                        {sourceKind !== "ONLINE" ? (
                          <div style={{ fontSize: 12, opacity: 0.78 }}>
                            {L.by}: <span className="ltr">{salesUser}</span> {salesStaffId ? <span className="mono">{salesStaffId}</span> : null}
                          </div>
                        ) : null}
                        <span
                          className="mono"
                          style={{
                            ...promoBadgeStyle(hasPromo),
                            padding: "2px 8px",
                            borderRadius: 999,
                            display: "inline-block",
                            fontSize: 11,
                            width: "fit-content",
                          }}
                        >
                          {L.promoApplied}: {promoLabel}
                        </span>
                      </div>
                    </td>

                    <td data-label={L.amount} className="ltr">
                      {amount}
                    </td>

                    <td data-label={L.customer}>{customer}</td>

                    <td data-label={L.created} style={{ fontSize: 12, opacity: 0.8 }}>
                      {new Date(r.created_at).toLocaleString(isAr ? "ar-JO" : undefined)}
                    </td>

                    <td data-label={L.details}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
                        </div>
                        {canConfirmManual ? (
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 6,
                              alignItems: "center",
                              flexWrap: "wrap",
                              padding: "6px 8px",
                              borderRadius: 10,
                              border: "1px solid #f3c58a",
                              background: "#fff9f2",
                              width: "fit-content",
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.78 }}>
                              {L.refundState}: {refundStateLabel}
                            </span>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => confirmManualRefund(r.id)}
                              disabled={busyId === r.id}
                              title={L.confirmManual}
                            >
                              {L.confirmManual}
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => failManualRefund(r.id)}
                              disabled={busyId === r.id}
                              title={L.failManual}
                            >
                              {L.failManual}
                            </button>
                          </div>
                        ) : null}
                      </div>
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
                          <option key={s} value={s} disabled={!allowsTransition(r.status, s)}>
                            {isAr ? `${s} — ${STATUS_AR[s] || ""}` : s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  {opened ? (
                    <tr key={`details-${r.id}`} className="admin-row-details">
                      <td data-label={L.details} colSpan={10}>
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
                                      {isAr ? item.name_ar || item.name_en || item.slug : item.name_en || item.name_ar || item.slug}
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
                              {L.promo}: {String(r.discount_source || L.dash)} {r.promo_code ? `(${r.promo_code})` : ""}{" "}
                              {r.promotion_id ? `#${r.promotion_id}` : ""} • {L.consumed}: {r.promo_consumed ? L.yes : L.no}
                              {r.promo_consume_failed
                                ? ` • ${L.consumeFailed}: ${String(r.promo_consume_error || "").trim() || L.yes}`
                                : ""}
                              <br />
                              {L.source}:{" "}
                              {String(r.sales_actor_role || "").trim()
                                ? `${L.salesDesk} • ${L.by} ${String(r.sales_actor_username || "").trim() || L.unknownSalesUser}`
                                : String(r.cart_id || "").toLowerCase().startsWith("sales_")
                                  ? L.salesDeskLegacy
                                  : L.online}
                              <br />
                              refund: {parseRefundId(r.last_refund_id) > 0 ? `#${parseRefundId(r.last_refund_id)}` : L.dash} • status:{" "}
                              {String(r.last_refund_status || L.dash)} • method: {String(r.last_refund_method || L.dash)}
                              {r.last_refund_error ? ` • error: ${r.last_refund_error}` : ""}
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
                <td colSpan={10} style={{ padding: 14, opacity: 0.7 }}>
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

              <div style={{ fontSize: 12, opacity: 0.8 }}>{L.restockNote}</div>

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
