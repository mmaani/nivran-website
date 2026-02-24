"use client";

import { useEffect, useMemo, useState } from "react";
import { readJsonSafe } from "@/lib/http";

type Profile = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  address_line1: string | null;
  city: string | null;
  is_verified: boolean;
};

type OrderListRow = {
  id: number;
  cart_id: string | null;
  status: string;
  created_at: string;
  amount_jod: string;

  subtotal_before_discount_jod?: string | null;
  discount_jod?: string | null;
  subtotal_after_discount_jod?: string | null;
  shipping_jod?: string | null;
  total_jod?: string | null;

  promo_code?: string | null;
  promotion_id?: string | null;
  discount_source?: string | null;
};

type OrderItemLine = {
  qty?: number;
  variant_id?: number;
  variantId?: number;
  product_slug?: string | null;
  productSlug?: string | null;
  slug?: string | null;
};

type CartReorderItem = { slug: string; qty: number; variantId: number | null };

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function toQty(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}

function pickSlug(line: OrderItemLine): string | null {
  const a = typeof line.product_slug === "string" ? line.product_slug : null;
  const b = typeof line.productSlug === "string" ? line.productSlug : null;
  const c = typeof line.slug === "string" ? line.slug : null;
  const s = (a || b || c || "").trim();
  return s ? s : null;
}

function statusClass(statusRaw: string): string {
  const s = String(statusRaw || "").toUpperCase();
  if (!s) return "status-chip";
  return `status-chip status-${s}`;
}

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const COPY = useMemo(
    () => ({
      verified: isAr ? "موثق" : "Verified",
      fullName: isAr ? "الاسم الكامل *" : "Full name *",
      email: isAr ? "البريد الإلكتروني" : "Email",
      phone: isAr ? "الهاتف *" : "Phone *",
      country: isAr ? "الدولة" : "Country",
      address: isAr ? "العنوان *" : "Address *",
      city: isAr ? "المدينة" : "City",
      save: isAr ? "حفظ" : "Save",
      saving: isAr ? "جارٍ الحفظ..." : "Saving...",
      saved: isAr ? "تم الحفظ." : "Saved.",
      error: isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.",
      none: isAr ? "—" : "—",
      details: isAr ? "التفاصيل" : "Details",
      reorder: isAr ? "إعادة الطلب" : "Re-order",
      reorderTitle: isAr ? "إعادة الطلب" : "Re-order",
      reorderBody: isAr
        ? "اختر طريقة إضافة المنتجات إلى السلة."
        : "Choose how you want to add these items to your cart.",
      startFresh: isAr ? "ابدأ بسلة جديدة" : "Start fresh",
      addToCart: isAr ? "أضف إلى السلة الحالية" : "Add to existing cart",
      cancel: isAr ? "إلغاء" : "Cancel",
      emptyOrders: isAr ? "لا توجد طلبات بعد." : "No orders yet.",
      amount: isAr ? "المبلغ" : "Amount",
      status: isAr ? "الحالة" : "Status",
      created: isAr ? "التاريخ" : "Created",
      id: isAr ? "رقم" : "ID",
      promo: isAr ? "خصم" : "Discount",
    }),
    [isAr]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");

  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderOrderId, setReorderOrderId] = useState<number | null>(null);

  const canSave = useMemo(() => {
    if (!fullName.trim()) return false;
    if (!phone.trim()) return false;
    if (!addressLine1.trim()) return false;
    return true;
  }, [fullName, phone, addressLine1]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    const a = (profile.full_name || "").trim();
    const b = (profile.phone || "").trim();
    const c = (profile.country || "").trim();
    const d = (profile.address_line1 || "").trim();
    const e = (profile.city || "").trim();
    return (
      a !== fullName.trim() ||
      b !== phone.trim() ||
      c !== country.trim() ||
      d !== addressLine1.trim() ||
      e !== city.trim()
    );
  }, [profile, fullName, phone, country, addressLine1, city]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg(null);

      try {
        const pr = await fetch("/api/auth/profile", { cache: "no-store" });
        const pj: unknown = await readJsonSafe(pr);
        if (!alive) return;

        if (!pr.ok || !pj || typeof pj !== "object" || (pj as Record<string, unknown>).ok !== true) {
          setLoading(false);
          return;
        }

        const p = (pj as Record<string, unknown>).profile as Profile;
        setProfile(p);

        setFullName((p.full_name || "").trim());
        setPhone((p.phone || "").trim());
        setCountry((p.country || "").trim());
        setAddressLine1((p.address_line1 || "").trim());
        setCity((p.city || "").trim());

        const or = await fetch("/api/orders", { cache: "no-store" });
        const oj: unknown = await readJsonSafe(or);
        if (!alive) return;

        if (or.ok && oj && typeof oj === "object" && (oj as Record<string, unknown>).ok === true) {
          const list = ((oj as Record<string, unknown>).orders || []) as OrderListRow[];
          setOrders(Array.isArray(list) ? list : []);
        } else {
          setOrders([]);
        }
      } catch {
        setOrders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function saveProfile() {
    if (!canSave) return;
    if (!isDirty) return;

    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          country: country.trim() || null,
          address_line1: addressLine1.trim(),
          city: city.trim() || null,
        }),
      });

      const data: unknown = await readJsonSafe(res);

      if (!res.ok || !data || typeof data !== "object" || (data as Record<string, unknown>).ok !== true) {
        setMsg(COPY.error);
        return;
      }

      const r = await fetch("/api/auth/profile", { cache: "no-store" });
      const j: unknown = await readJsonSafe(r);
      if (r.ok && j && typeof j === "object" && (j as Record<string, unknown>).ok === true) {
        const p = (j as Record<string, unknown>).profile as Profile;
        setProfile(p);
      }

      setMsg(COPY.saved);
    } catch {
      setMsg(COPY.error);
    } finally {
      setSaving(false);
    }
  }

  async function openReorder(orderId: number) {
    setReorderOrderId(orderId);
    setReorderOpen(true);
    setMsg(null);
  }

  async function applyReorder(mode: "replace" | "add") {
    if (!reorderOrderId) return;

    setReorderBusy(true);
    try {
      const res = await fetch(`/api/orders?id=${reorderOrderId}&includeItems=1`, { cache: "no-store" });
      const data: unknown = await readJsonSafe(res);

      if (!res.ok || !data || typeof data !== "object" || (data as Record<string, unknown>).ok !== true) {
        setMsg(COPY.error);
        return;
      }

      const orderObj = (data as Record<string, unknown>).order as Record<string, unknown> | undefined;
      const linesUnknown = orderObj ? (orderObj.line_items as unknown) : null;

      const list = Array.isArray(linesUnknown) ? (linesUnknown as OrderItemLine[]) : [];

      const mapped: CartReorderItem[] = list
        .map((x) => {
          const slug = pickSlug(x);
          if (!slug) return null;
          const qty = toQty(x.qty);
          const variantId = toInt(x.variant_id ?? x.variantId);
          return { slug, qty, variantId: variantId ?? null };
        })
        .filter((x): x is CartReorderItem => Boolean(x));

      if (!mapped.length) {
        setMsg(COPY.error);
        return;
      }

      try {
        sessionStorage.setItem("nivran_reorder_payload_v1", JSON.stringify({ items: mapped, mode }));
      } catch {
        // ignore
      }

      window.location.href = `/${locale}/cart?reorder=1`;
    } catch {
      setMsg(COPY.error);
    } finally {
      setReorderBusy(false);
      setReorderOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="account-shell">
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {isAr ? "جارٍ التحميل..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="account-shell">
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {isAr ? "يرجى تسجيل الدخول أولاً." : "Please log in first."}
          </p>
          <div style={{ marginTop: 12 }}>
            <a className="btn primary" href={`/${locale}/account/login`}>
              {isAr ? "تسجيل الدخول" : "Login"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-shell">
      <div className="account-grid">
        <div className="card card-soft">
          <div className="card-head">
            <span className={"badge " + (profile.is_verified ? "badge-verified" : "")}>
              {profile.is_verified ? COPY.verified : (isAr ? "غير موثق" : "Unverified")}
            </span>
            {msg ? <span className="muted">{msg}</span> : null}
          </div>

          <div className="form-grid">
            <div className="field">
              <label>{COPY.fullName}</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="field">
              <label>{COPY.email}</label>
              <input className="input" value={profile.email} readOnly />
            </div>

            <div className="field">
              <label>{COPY.phone}</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="field">
              <label>{COPY.country}</label>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>{COPY.address}</label>
              <input className="input" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>{COPY.city}</label>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <div className="actions-row">
            <button
              className={"btn primary" + (!canSave || !isDirty || saving ? " btn-disabled" : "")}
              disabled={!canSave || !isDirty || saving}
              onClick={saveProfile}
            >
              {saving ? COPY.saving : COPY.save}
            </button>
          </div>
        </div>

        <div className="card">
          {orders.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {COPY.emptyOrders}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{COPY.id}</th>
                    <th>{COPY.created}</th>
                    <th>{COPY.status}</th>
                    <th>{COPY.amount}</th>
                    <th>{COPY.promo}</th>
                    <th style={{ width: 220 }} />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const status = String(o.status || "").toUpperCase();
                    const total = o.total_jod ? Number(o.total_jod) : Number(o.amount_jod || 0);
                    const discount = o.discount_jod ? Number(o.discount_jod) : 0;

                    const promoText =
                      o.discount_source && String(o.discount_source).toUpperCase() === "CODE"
                        ? (o.promo_code || "").toString().trim() || COPY.none
                        : discount > 0
                          ? `-${discount.toFixed(2)} JOD`
                          : COPY.none;

                    return (
                      <tr key={o.id}>
                        <td data-label={COPY.id}>
                          <strong>#{o.id}</strong>
                        </td>

                        <td data-label={COPY.created}>
                          <span className="muted">{new Date(o.created_at).toLocaleString()}</span>
                        </td>

                        <td data-label={COPY.status}>
                          <span className={statusClass(status)}>{status}</span>
                        </td>

                        <td data-label={COPY.amount}>
                          <strong>{Number.isFinite(total) ? total.toFixed(2) : "0.00"} JOD</strong>
                        </td>

                        <td data-label={COPY.promo}>
                          <span className="muted">{promoText}</span>
                        </td>

                        <td data-label={COPY.none}>
                          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <a className="btn btn-quiet" href={`/${locale}/account/orders/${o.id}`}>
                              {COPY.details}
                            </a>
                            <button className="btn primary" onClick={() => openReorder(o.id)}>
                              {COPY.reorder}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {reorderOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>{COPY.reorderTitle}</h3>
            <p className="muted">{COPY.reorderBody}</p>
            <div className="modal-actions">
              <button className="btn btn-quiet" onClick={() => setReorderOpen(false)} disabled={reorderBusy}>
                {COPY.cancel}
              </button>
              <button className="btn btn-quiet" onClick={() => applyReorder("add")} disabled={reorderBusy}>
                {COPY.addToCart}
              </button>
              <button className="btn primary" onClick={() => applyReorder("replace")} disabled={reorderBusy}>
                {COPY.startFresh}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
