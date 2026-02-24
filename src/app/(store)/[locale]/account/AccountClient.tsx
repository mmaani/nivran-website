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
  return typeof v === "object" && v !== null;
}

function smallPill(label: string, tone: "neutral" | "gold") {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    border: "1px solid rgba(0,0,0,.08)",
    background: tone === "gold" ? "rgba(201,164,106,.16)" : "rgba(0,0,0,.04)",
    color: "rgba(0,0,0,.78)",
    whiteSpace: "nowrap" as const,
  };
}

function moneyOrDash(v: string | null | undefined) {
  if (!v) return "—";
  return `${v} JOD`;
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
      saveErr: isAr ? "تعذر الحفظ الآن" : "Unable to save right now",
      ordersEmpty: isAr ? "لا توجد طلبات بعد." : "No orders yet.",
      view: isAr ? "عرض" : "View",
      status: isAr ? "الحالة" : "Status",
      created: isAr ? "التاريخ" : "Created",
      amount: isAr ? "المبلغ" : "Amount",
      total: isAr ? "الإجمالي" : "Total",
      discountsApplied: isAr ? "الخصومات المطبقة" : "Discounts applied",
      promoCode: isAr ? "الكود" : "Code",
      discount: isAr ? "قيمة الخصم" : "Discount",
      source: isAr ? "المصدر" : "Source",
      none: isAr ? "—" : "—",
      logout: isAr ? "تسجيل الخروج" : "Logout",
      emailLocked: isAr ? "لا يمكن تغيير البريد الإلكتروني" : "Email cannot be changed",
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
    fetchAll().catch(() => {
      setLoading(false);
    });
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

  if (loading) return <p className="muted">{t.loading}</p>;

  if (!profile) {
    return (
      <div style={{ padding: "1.2rem 0", maxWidth: 980, margin: "0 auto" }}>
        <div className="panel">
          <h1 className="title" style={{ marginTop: 0 }}>
            {t.title}
          </h1>
          <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
            {isAr ? "تعذر تحميل الحساب. الرجاء تسجيل الدخول من جديد." : "Unable to load account. Please log in again."}
          </p>
          <a className="btn" href={`/${locale}/account/login`}>
            {isAr ? "تسجيل الدخول" : "Login"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="title" style={{ marginTop: 0, marginBottom: 6 }}>
            {t.title}
          </h1>
          <p className="muted" style={{ marginTop: 0 }}>
            {t.subtitle}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-outline" type="button" onClick={logout}>
            {t.logout}
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 14,
        }}
      >
        {/* Profile card */}
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>{t.profileTitle}</h3>

            <span style={profile.email_verified_at ? smallPill(t.verified, "neutral") : smallPill(t.unverified, "gold")}>
              {profile.email_verified_at ? t.verified : t.unverified}
            </span>
          </div>

          <div className="grid-2" style={{ gap: 10, marginTop: 12 }}>
            <label>
              <span className="muted">{t.fullName}</span>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isAr ? "مثال: محمد المعاني" : "e.g. Mohammad Maani"}
                autoComplete="name"
              />
            </label>

            <label>
              <span className="muted">{t.email}</span>
              <input
                className="input"
                value={profile.email}
                readOnly
                disabled
                aria-readonly="true"
                title={t.emailLocked}
                autoComplete="email"
                style={{ opacity: 0.75, cursor: "not-allowed" }}
              />
            </label>

            <label>
              <span className="muted">{t.phone}</span>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isAr ? "رقم الهاتف" : "Phone number"}
                autoComplete="tel"
              />
            </label>

            <label>
              <span className="muted">{t.country}</span>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t.country} autoComplete="country-name" />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted">{t.address}</span>
              <input
                className="input"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder={isAr ? "العنوان" : "Address line"}
                autoComplete="street-address"
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted">{t.city}</span>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.city} autoComplete="address-level2" />
            </label>
          </div>

          {err ? (
            <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
              {err}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className={"btn" + (!canSave ? " btn-disabled" : "")} disabled={!canSave} onClick={saveProfile}>
              {savingProfile ? (isAr ? "جارٍ الحفظ..." : "Saving...") : t.save}
            </button>
            {profileSaved ? <span className="muted">{isAr ? "تم الحفظ" : "Saved"}</span> : null}
          </div>
        </div>

        {/* Orders card */}
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{t.ordersTitle}</h3>

          {!orders.length ? (
            <p className="muted" style={{ marginTop: 8 }}>
              {t.ordersEmpty}
            </p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="table" style={{ minWidth: 760 }}>
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
                      <td>{o.id}</td>
                      <td>{o.status}</td>
                      <td>{o.created_at}</td>
                      <td>{moneyOrDash(o.amount_jod)}</td>
                      <td>{moneyOrDash(o.total_jod ?? o.amount_jod)}</td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div className="muted">
                            {t.promoCode}: <strong>{o.promo_code ?? t.none}</strong>
                          </div>
                          <div className="muted">
                            {t.discount}: <strong>{moneyOrDash(o.discount_jod)}</strong>
                          </div>
                          <div className="muted">
                            {t.source}: <strong>{o.discount_source ?? t.none}</strong>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <a className="btn btn-outline" href={`/${locale}/account/orders/${o.id}`}>
                          {t.view}
                        </a>
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
