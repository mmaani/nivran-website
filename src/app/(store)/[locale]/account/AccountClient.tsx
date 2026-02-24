"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Profile = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  email_verified_at: string | null;
  promotions?: unknown[] | null;
  orders?: unknown[] | null;
};

type OrderRow = {
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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function moneyOrDash(v: string | null | undefined) {
  if (!v) return "—";
  return `${v} JOD`;
}

function statusChipClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (s.includes("DELIVERED")) return "chip chip--delivered";
  if (s.includes("PAID")) return "chip chip--paid";
  if (s.includes("SHIPPED")) return "chip chip--shipped";
  if (s.includes("FAILED")) return "chip chip--failed";
  if (s.includes("CANCEL")) return "chip chip--cancelled";
  if (s.includes("PENDING")) return "chip chip--pending";
  return "chip chip--neutral";
}

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const t = useMemo(() => {
    return {
      title: isAr ? "الحساب" : "Account",
      subtitle: isAr ? "إدارة معلوماتك وطلباتك." : "Manage your details and orders.",
      loading: isAr ? "جارٍ التحميل..." : "Loading...",

      verified: isAr ? "موثق" : "Verified",
      unverified: isAr ? "غير موثق" : "Unverified",

      profileTitle: isAr ? "ملفك الشخصي" : "Your profile",
      ordersTitle: isAr ? "الطلبات" : "Orders",

      fullName: isAr ? "الاسم الكامل *" : "Full name *",
      email: isAr ? "البريد الإلكتروني" : "Email",
      phone: isAr ? "الهاتف *" : "Phone *",
      country: isAr ? "الدولة" : "Country",
      address: isAr ? "العنوان *" : "Address *",
      city: isAr ? "المدينة" : "City",

      save: isAr ? "حفظ" : "Save",
      saving: isAr ? "جارٍ الحفظ..." : "Saving...",
      saved: isAr ? "تم الحفظ" : "Saved",
      saveErr: isAr ? "تعذر الحفظ الآن" : "Unable to save right now",

      ordersEmpty: isAr ? "لا توجد طلبات بعد." : "No orders yet.",
      view: isAr ? "عرض" : "View",
      status: isAr ? "الحالة" : "Status",
      created: isAr ? "التاريخ" : "Created",
      amount: isAr ? "المبلغ" : "Amount",
      total: isAr ? "الإجمالي" : "Total",
      discountsApplied: isAr ? "الخصومات" : "Discounts",
      promoCode: isAr ? "الكود" : "Code",
      discount: isAr ? "قيمة الخصم" : "Discount",
      source: isAr ? "المصدر" : "Source",
      none: "—",

      logout: isAr ? "تسجيل الخروج" : "Logout",
      emailLocked: isAr ? "لا يمكن تغيير البريد الإلكتروني" : "Email cannot be changed",

      cannotLoad: isAr ? "تعذر تحميل الحساب. الرجاء تسجيل الدخول من جديد." : "Unable to load account. Please log in again.",
      login: isAr ? "تسجيل الدخول" : "Login",
    };
  }, [isAr]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");

  const canSave = useMemo(
    () => !savingProfile && !!fullName.trim() && !!phone.trim() && !!addressLine1.trim(),
    [fullName, phone, addressLine1, savingProfile]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setProfileSaved(false);

    const res = await fetch("/api/auth/profile", { cache: "no-store" });
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok || !isObject(data) || data.ok !== true || !isObject(data.profile)) {
      setProfile(null);
      setOrders([]);
      setLoading(false);
      return;
    }

    const p = data.profile as unknown as Profile;
    setProfile(p);

    setFullName(String(p.full_name || ""));
    setPhone(String(p.phone || ""));
    setAddressLine1(String(p.address_line1 || ""));
    setCity(String(p.city || ""));
    setCountry(String(p.country || "Jordan"));

    try {
      const rOrders = await fetch("/api/orders", { cache: "no-store" });
      const dOrders: unknown = await rOrders.json().catch(() => null);
      if (rOrders.ok && isObject(dOrders) && dOrders.ok === true && Array.isArray(dOrders.orders)) {
        setOrders(dOrders.orders as OrderRow[]);
      } else if (Array.isArray((data as Record<string, unknown>).orders)) {
        setOrders((data as Record<string, unknown>).orders as OrderRow[]);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll().catch(() => setLoading(false));
  }, [fetchAll]);

  async function saveProfile() {
    if (!canSave) return;

    setErr(null);
    setProfileSaved(false);
    setSavingProfile(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          address_line1: addressLine1,
          city,
          country,
        }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok || !isObject(data) || data.ok !== true) {
        const msg = isObject(data) && typeof data.error === "string" ? data.error : t.saveErr;
        setErr(msg);
        return;
      }

      const r = await fetch("/api/auth/profile", { cache: "no-store" });
      const d: unknown = await r.json().catch(() => null);
      if (r.ok && isObject(d) && d.ok === true && isObject(d.profile)) {
        setProfile(d.profile as unknown as Profile);
        setProfileSaved(true);
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = `/${locale}/`;
  }

  if (loading) return <div className="account-shell"><p className="muted">{t.loading}</p></div>;

  if (!profile) {
    return (
      <div className="account-shell">
        <div className="panel account-panel">
          <h1 className="title account-title">{t.title}</h1>
          <p className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>{t.cannotLoad}</p>
          <a className="btn primary" href={`/${locale}/account/login`}>{t.login}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="account-shell">
      <div className="account-head">
        <div>
          <h1 className="title account-title">{t.title}</h1>
          <p className="account-subtitle">{t.subtitle}</p>
        </div>
        <div className="account-actions">
          <button className="btn btn-outline" type="button" onClick={logout}>{t.logout}</button>
        </div>
      </div>

      <div className="account-grid">
        {/* PROFILE */}
        <div className="panel account-panel">
          <div className="account-panel-head">
            <h3 className="account-panel-title">{t.profileTitle}</h3>
            <span className={profile.email_verified_at ? "chip chip--paid" : "chip chip--pending"}>
              <span className="chip-dot" />
              {profile.email_verified_at ? t.verified : t.unverified}
            </span>
          </div>

          <div className="field-grid">
            <label className="field">
              <span className="field-label">{t.fullName}</span>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </label>

            <label className="field">
              <span className="field-label">{t.email}</span>
              <input
                className="input"
                value={profile.email}
                readOnly
                disabled
                aria-readonly="true"
                title={t.emailLocked}
                autoComplete="email"
                style={{ cursor: "not-allowed" }}
              />
              <span className="field-help">{t.emailLocked}</span>
            </label>

            <label className="field">
              <span className="field-label">{t.phone}</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>

            <label className="field">
              <span className="field-label">{t.country}</span>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" />
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field-label">{t.address}</span>
              <input className="input" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} autoComplete="street-address" />
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field-label">{t.city}</span>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </label>
          </div>

          {err ? <p className="muted" style={{ marginTop: 12, lineHeight: 1.7 }}>{err}</p> : null}

          <div className="account-divider" />

          <div className="account-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className={"btn primary" + (!canSave ? " btn-disabled" : "")} disabled={!canSave} onClick={saveProfile}>
              {savingProfile ? t.saving : t.save}
            </button>
            {profileSaved ? <span className="muted">{t.saved}</span> : null}
          </div>
        </div>

        {/* ORDERS */}
        <div className="panel account-panel">
          <div className="account-panel-head">
            <h3 className="account-panel-title">{t.ordersTitle}</h3>
          </div>

          {!orders.length ? (
            <p className="muted">{t.ordersEmpty}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t.status}</th>
                    <th>{t.created}</th>
                    <th>{t.amount}</th>
                    <th>{t.total}</th>
                    <th>{t.discountsApplied}</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td data-label="ID"><strong>{o.id}</strong></td>

                      <td data-label={t.status}>
                        <span className={statusChipClass(o.status)}>
                          <span className="chip-dot" />
                          {o.status}
                        </span>
                      </td>

                      <td data-label={t.created}>{o.created_at}</td>
                      <td data-label={t.amount}>{moneyOrDash(o.amount_jod)}</td>
                      <td data-label={t.total}>{moneyOrDash(o.total_jod ?? o.amount_jod)}</td>

                      <td data-label={t.discountsApplied}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div className="muted">{t.promoCode}: <strong>{o.promo_code ?? t.none}</strong></div>
                          <div className="muted">{t.discount}: <strong>{moneyOrDash(o.discount_jod)}</strong></div>
                          <div className="muted">{t.source}: <strong>{o.discount_source ?? t.none}</strong></div>
                        </div>
                      </td>

                      <td data-label="">
                        <div className="order-actions">
                          <a className="btn btn-outline" href={`/${locale}/account/orders/${o.id}`}>{t.view}</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
