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
  sales_actor_display_name?: string | null;
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

function compactCartId(cartId: string): string {
  const raw = String(cartId || "");
  if (raw.length <= 24) return raw;
  return `${raw.slice(0, 14)}...${raw.slice(-7)}`;
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
        search: "ابحث برقم السلة / الحالة / العميل / الهاتف / البائع / الكوبون",
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
        customerDetails: "تفاصيل العميل",
        shippingDetails: "الشحن",
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

        confirmManual: "اعتماد الاسترجاع",
        failManual: "رفض الاسترجاع",
        refundState: "بانتظار قرار الاسترجاع",
        refundDecisionHint: "إجراء مطلوب",
      };
    }

    return {
      search: "Search by cart_id / status / customer / phone / salesperson / promo",
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
      customerDetails: "Customer details",
      shippingDetails: "Shipping",
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

      confirmManual: "Approve Refund",
      failManual: "Reject Refund",
      refundState: "Refund decision pending",
      refundDecisionHint: "Action required",
    };
  }, [isAr]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const bySearch = rows.filter((r) => {
      const name = readString(r.customer, "name").toLowerCase();
      const phone = readString(r.customer, "phone").toLowerCase();
      const salesUser = String(r.sales_actor_display_name || r.sales_actor_username || "").toLowerCase();
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
        (statusUpper === "REFUND_PENDING" || lastRefundStatus === "REQUESTED");

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
        (statusUpper === "REFUND_PENDING" || lastRefundStatus === "REQUESTED");
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
              <th style={{ width: 68 }}>{L.id}</th>
              <th style={{ width: 190 }}>{L.cart}</th>
              <th>{L.status}</th>
              <th>{L.payment}</th>
              <th>{L.source}</th>
              <th style={{ width: 120 }}>{L.amount}</th>
              <th>{L.customer}</th>
              <th>{L.details}</th>
              <th className="orders-update-head" style={{ width: 210 }}>{L.update}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const cname = readString(r.customer, "name") || L.dash;
              const cphone = readString(r.customer, "phone") || L.dash;
              const cemail = readString(r.customer, "email") || L.dash;
              const customer = cname;
              const shipCity = readString(r.shipping, "city") || L.dash;
              const shipAddress = readString(r.shipping, "address") || L.dash;
              const shipCountry = readString(r.shipping, "country") || L.dash;

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
              const salesUser =
                String(r.sales_actor_display_name || "").trim() || String(r.sales_actor_username || "").trim() || L.unknownSalesUser;
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
                (statusUpper === "REFUND_PENDING" || lastRefundStatus === "REQUESTED");
              const refundStateLabel = String(r.last_refund_status || r.status || "").toUpperCase() || L.dash;

              return (
                <Fragment key={`row-${r.id}`}>
                  <tr>
                    <td data-label={L.id} className="ltr">
                      {r.id}
                    </td>

                    <td data-label={L.cart} className="ltr">
                      <span className="mono orders-cart-id" title={r.cart_id}>
                        {compactCartId(r.cart_id)}
                      </span>
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
                      <div className="orders-source-cell" style={{ display: "grid", gap: 6 }}>
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
                        {hasPromo ? (
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
                        ) : null}
                      </div>
                    </td>

                    <td data-label={L.amount} className="ltr">
                      {amount}
                    </td>

                    <td data-label={L.customer}>
                      <div>{customer}</div>
                      <div style={{ fontSize: 12, opacity: 0.76, marginTop: 4 }}>
                        {new Date(r.created_at).toLocaleString(isAr ? "ar-JO" : undefined)}
                      </div>
                    </td>

                    <td data-label={L.details} className="orders-actions-cell">
                      <div className="orders-actions-shell" style={{ display: "grid", gap: 8 }}>
                        <div className="orders-actions-row" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
                      </div>
                    </td>

                    <td data-label={L.update} className="orders-update-cell orders-update-sticky">
                      <div className="orders-update-stack">
                        <select
                          value={r.status}
                          disabled={busyId === r.id}
                          onChange={(e) => updateStatus(r.id, e.target.value)}
                          className="admin-select"
                          style={{ width: "100%", minWidth: 170 }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s} disabled={!allowsTransition(r.status, s)}>
                              {isAr ? `${s} — ${STATUS_AR[s] || ""}` : s}
                            </option>
                          ))}
                        </select>
                        {canConfirmManual ? (
                          <div className="orders-refund-panel">
                            <span className="orders-refund-hint">{L.refundDecisionHint}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.92 }}>
                              {L.refundState}: <span className="mono">{refundStateLabel}</span>
                            </span>
                            <div className="orders-refund-btns">
                              <button
                                className="btn orders-refund-approve"
                                type="button"
                                onClick={() => confirmManualRefund(r.id)}
                                disabled={busyId === r.id}
                                title={L.confirmManual}
                              >
                                {L.confirmManual}
                              </button>
                              <button
                                className="btn orders-refund-reject"
                                type="button"
                                onClick={() => failManualRefund(r.id)}
                                disabled={busyId === r.id}
                                title={L.failManual}
                              >
                                {L.failManual}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
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
                            <strong>{L.customerDetails}</strong>
                            <div className="mono" style={{ marginTop: 4 }}>
                              name: {cname}
                              <br />
                              phone: {cphone}
                              <br />
                              email: {cemail}
                            </div>
                            <div className="mono" style={{ marginTop: 6 }}>
                              {L.shippingDetails}: {shipCity} • {shipAddress} • {shipCountry}
                            </div>
                          </div>

                          <div>
                            <strong>{L.totals}</strong>
                            <div className="mono" style={{ marginTop: 4 }}>
                              {L.subtotal}: {toNum(r.subtotal_before_discount_jod).toFixed(2)} JOD • {L.discount}:{" "}
                              {toNum(r.discount_jod).toFixed(2)} JOD • {L.shipping}: {toNum(r.shipping_jod).toFixed(2)} JOD •{" "}
                              {L.total}: {toNum(r.total_jod ?? r.amount).toFixed(2)} JOD
                              <br />
                              {String(r.discount_source || "").trim() ? (
                                <>
                                  {L.promo}: {String(r.discount_source || L.dash)} {r.promo_code ? `(${r.promo_code})` : ""}{" "}
                                  {r.promotion_id ? `#${r.promotion_id}` : ""} • {L.consumed}: {r.promo_consumed ? L.yes : L.no}
                                  {r.promo_consume_failed
                                    ? ` • ${L.consumeFailed}: ${String(r.promo_consume_error || "").trim() || L.yes}`
                                    : ""}
                                  <br />
                                </>
                              ) : null}
                              {L.source}:{" "}
                              {String(r.sales_actor_role || "").trim()
                                ? `${L.salesDesk} • ${L.by} ${String(r.sales_actor_display_name || r.sales_actor_username || "").trim() || L.unknownSalesUser}`
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
      <style jsx>{`
        .orders-cart-id {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: inline-block;
          vertical-align: top;
        }
        .orders-source-cell {
          max-width: 260px;
        }
        .orders-update-head,
        .orders-update-sticky {
          position: sticky;
          inset-inline-end: 0;
          z-index: 4;
          box-shadow: -1px 0 0 rgba(20, 20, 20, 0.12);
          background: #fffdf8;
        }
        .orders-update-head {
          z-index: 6;
          background: linear-gradient(180deg, #f8f1e3, #f2e7d2);
        }
        .orders-actions-row .btn {
          min-width: 84px;
        }
        .orders-actions-shell {
          border: 1px solid rgba(20, 20, 20, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(252, 247, 237, 0.9));
          border-radius: 12px;
          padding: 8px;
        }
        .orders-update-stack {
          display: grid;
          gap: 8px;
        }
        .orders-refund-panel {
          display: grid;
          gap: 6px;
          border: 1px solid #efb969;
          border-radius: 12px;
          background: linear-gradient(180deg, #fff8ee, #fff2df);
          padding: 10px 10px;
        }
        .orders-refund-hint {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #8d4f00;
        }
        .orders-refund-btns {
          display: flex;
          gap: 6px;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .orders-refund-btns .btn {
          white-space: nowrap;
          min-height: 40px;
          padding-inline: 14px;
          font-size: 13px;
          font-weight: 800;
        }
        .orders-refund-approve {
          border-color: #9fd9b5 !important;
          background: linear-gradient(180deg, #f0fff6, #e4f9ed) !important;
          color: #16613a !important;
        }
        .orders-refund-reject {
          border-color: #f0b4b4 !important;
          background: linear-gradient(180deg, #fff3f3, #ffe6e6) !important;
          color: #8f1f1f !important;
        }
        @media (max-width: 640px) {
          .orders-source-cell {
            max-width: 100%;
            gap: 4px;
          }
          .orders-source-cell .mono {
            overflow-wrap: anywhere;
            white-space: normal;
          }
          .orders-actions-cell :global(.btn) {
            min-width: 72px;
            padding-inline: 10px;
            font-size: 12px;
          }
          .orders-actions-shell {
            padding: 6px;
            border-radius: 10px;
          }
          .orders-actions-row {
            gap: 5px;
          }
          .orders-update-stack {
            gap: 6px;
          }
          .orders-refund-panel {
            padding: 8px;
            border-radius: 10px;
          }
          .orders-refund-btns {
            gap: 5px;
          }
          .orders-refund-btns .btn {
            min-height: 36px;
            padding-inline: 10px;
            font-size: 12px;
          }
          .orders-update-cell :global(.admin-select) {
            min-width: 0 !important;
            width: 100% !important;
          }
          .orders-update-head,
          .orders-update-sticky {
            position: static;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
