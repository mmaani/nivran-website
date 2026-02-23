"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  email_verified_at: string | null;
  created_at: string;
};

type OrderRow = {
  id: number;
  cart_id: string;
  status: string;
  amount_jod: string;
  subtotal_jod?: string | null;
  shipping_jod?: string | null;
  discount_jod?: string | null;
  total_jod?: string | null;
  promo_code?: string | null;
  promotion_id?: string | null;
  discount_source?: string | null;
  promo_rule_title?: string | null;
  created_at: string;
};

function formatJod(v: unknown) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0.00 JOD";
  return `${n.toFixed(2)} JOD`;
}

function formatDate(d: string) {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return d;
  return t.toLocaleString();
}

function statusLabel(s: string) {
  const v = String(s || "").trim().toUpperCase();
  return v || "—";
}

function pillStyleForStatus(): React.CSSProperties {
  // Neutral design: subtle background + border, no loud colors.
  // (You can later map statuses to brand colors if you want.)
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,.12)",
    background: "rgba(0,0,0,.02)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: ".02em",
    whiteSpace: "nowrap",
  };
}

function smallPill(text: string, tone: "neutral" | "gold" = "neutral"): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: tone === "gold" ? "1px solid rgba(201,164,106,.55)" : "1px solid rgba(0,0,0,.12)",
    background: tone === "gold" ? "rgba(201,164,106,.10)" : "rgba(0,0,0,.02)",
    whiteSpace: "nowrap",
  };
}

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      title: isAr ? "حسابي" : "My Account",
      loading: isAr ? "جارٍ التحميل..." : "Loading...",
      login: isAr ? "تسجيل الدخول" : "Login",
      logout: isAr ? "تسجيل خروج" : "Logout",

      verifyTitle: isAr ? "بريدك غير مُؤكَّد" : "Email not verified",
      verifyBody: isAr
        ? "أكد بريدك لتأمين حسابك واستلام تحديثات الطلبات."
        : "Verify your email to secure your account and receive order updates.",
      verifyBtn: isAr ? "تأكيد الآن" : "Verify now",

      profileTitle: isAr ? "ملفك الشخصي" : "Your profile",
      ordersTitle: isAr ? "الطلبات" : "Orders",

      fullName: isAr ? "الاسم الكامل *" : "Full name *",
      email: isAr ? "البريد الإلكتروني" : "Email",
      verified: isAr ? "مؤكد" : "Verified",
      unverified: isAr ? "غير مؤكد" : "Unverified",
      phone: isAr ? "الهاتف *" : "Phone *",
      country: isAr ? "الدولة" : "Country",
      address: isAr ? "العنوان *" : "Address *",
      city: isAr ? "المدينة" : "City",

      save: isAr ? "حفظ" : "Save",
      saveErr: isAr ? "تعذر حفظ البيانات." : "Could not save profile.",

      ordersEmpty: isAr ? "لا توجد طلبات بعد." : "No orders yet.",
      id: isAr ? "الرقم" : "ID",
      cart: isAr ? "السلة" : "Cart",
      status: isAr ? "الحالة" : "Status",
      total: isAr ? "الإجمالي" : "Total",
      discount: isAr ? "الخصم" : "Discount",
      promo: isAr ? "الخصومات المطبقة" : "Discounts applied",
      date: isAr ? "التاريخ" : "Date",
      actions: isAr ? "إجراءات" : "Actions",
      details: isAr ? "التفاصيل" : "Details",
      comingSoon: isAr ? "قريباً" : "Coming soon",

      promoTitle: isAr ? "العروض والخصومات" : "Promotions",
      promoBody: isAr
        ? "أكواد الخصم تُطبَّق أثناء الدفع. تابع صفحة المتجر للعروض الحالية."
        : "Promo codes are applied during checkout. Check the shop for current offers.",
      shop: isAr ? "الانتقال للمتجر" : "Go to shop",
    }),
    [isAr]
  );

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");

  const canSave = useMemo(() => !!fullName.trim() && !!phone.trim() && !!addressLine1.trim(), [
    fullName,
    phone,
    addressLine1,
  ]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/auth/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!alive) return;

      if (!res.ok || !data?.ok) {
        window.location.href = `/${locale}/account/login`;
        return;
      }

      setProfile(data.profile);

      // Prefer the hardened Orders API (customer-scoped) for discount/promo visibility.
      try {
        const rOrders = await fetch("/api/orders", { cache: "no-store" });
        const dOrders = await rOrders.json().catch(() => ({}));
        if (rOrders.ok && dOrders?.ok && Array.isArray(dOrders.orders)) {
          setOrders(dOrders.orders);
        } else {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      }
setFullName(String(data.profile?.full_name || ""));
      setPhone(String(data.profile?.phone || ""));
      setAddressLine1(String(data.profile?.address_line1 || ""));
      setCity(String(data.profile?.city || ""));
      setCountry(String(data.profile?.country || "Jordan"));

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [locale]);

  async function saveProfile() {
    setErr(null);
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setErr(data?.error || t.saveErr);
      return;
    }

    // Refresh
    const r = await fetch("/api/auth/profile", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.ok) setProfile(d.profile);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = `/${locale}/`;
  }

  if (loading) return <p className="muted">{t.loading}</p>;

  if (!profile) {
    return (
      <div className="panel">
        <p className="muted">{err || (isAr ? "يرجى تسجيل الدخول." : "Please login.")}</p>
        <a className="btn" href={`/${locale}/account/login`}>
          {t.login}
        </a>
      </div>
    );
  }

  const dir = isAr ? "rtl" : "ltr";

  const thStyle: React.CSSProperties = {
    textAlign: isAr ? "right" : "left",
    padding: "10px 12px",
    fontSize: 12,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "rgba(0,0,0,.55)",
    borderBottom: "1px solid rgba(0,0,0,.08)",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 12px",
    borderBottom: "1px solid rgba(0,0,0,.06)",
    verticalAlign: "middle",
  };

  return (
    <div dir={dir} style={{ padding: "1.2rem 0", maxWidth: 980, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            {t.title}
          </h1>
          <div className="muted" style={{ marginTop: 6 }}>
            {profile.full_name ? profile.full_name : profile.email}
          </div>
        </div>

        <button className="btn btn-outline" onClick={logout}>
          {t.logout}
        </button>
      </div>

      {/* Verification banner */}
      {!profile.email_verified_at ? (
        <div className="panel" style={{ marginTop: 14, border: "1px solid rgba(201,164,106,.45)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{t.verifyTitle}</div>
              <div className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
                {t.verifyBody}
              </div>
            </div>
            <a className="btn" href={`/${locale}/account/verify?email=${encodeURIComponent(profile.email)}`}>
              {t.verifyBtn}
            </a>
          </div>
        </div>
      ) : null}

      {/* Main grid */}
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
              />
            </label>

            <label>
              <span className="muted">{t.email}</span>
              <input className="input" value={profile.email} readOnly />
            </label>

            <label>
              <span className="muted">{t.phone}</span>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isAr ? "رقم الهاتف" : "Phone number"}
              />
            </label>

            <label>
              <span className="muted">{t.country}</span>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t.country} />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted">{t.address}</span>
              <input
                className="input"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder={isAr ? "العنوان" : "Address line"}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted">{t.city}</span>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.city} />
            </label>
          </div>

          {err ? <p style={{ color: "crimson", marginTop: 10, marginBottom: 0 }}>{err}</p> : null}

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className={"btn" + (!canSave ? " btn-disabled" : "")} disabled={!canSave} onClick={saveProfile}>
              {t.save}
            </button>
          </div>
        </div>

        {/* Promotions (simple info card for now) */}
        <div className="panel">
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>{t.promoTitle}</h3>
          <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
            {t.promoBody}
          </p>
          <a className="btn btn-outline" href={`/${locale}/product`}>
            {t.shop}
          </a>
        </div>

        {/* Orders card */}
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>{t.ordersTitle}</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              {orders.length ? `${orders.length}` : "0"}
            </div>
          </div>

          {orders.length ? (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="table" style={{ minWidth: 820, borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 70 }}>{t.id}</th>
                    <th style={{ ...thStyle, width: 260 }}>{t.cart}</th>
                    <th style={{ ...thStyle, width: 170 }}>{t.status}</th>
                    <th style={{ ...thStyle, width: 150 }}>{t.total}</th>
                    <th style={{ ...thStyle, width: 140 }}>{t.discount}</th>
                    <th style={{ ...thStyle, width: 220 }}>{t.promo}</th>
                    <th style={{ ...thStyle, width: 220 }}>{t.date}</th>
                    <th style={{ ...thStyle, width: 120 }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{o.id}</td>

                      <td style={{ ...tdStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
                        {o.cart_id}
                      </td>

                      <td style={tdStyle}>
                        <span style={pillStyleForStatus()}>{statusLabel(o.status)}</span>
                      </td>

                      <td style={{ ...tdStyle, fontWeight: 700 }}>{formatJod(o.total_jod ?? o.amount_jod)}</td>

                      <td style={{ ...tdStyle, fontWeight: 650 }}>
                        {Number(o.discount_jod || 0) > 0 ? `-${formatJod(o.discount_jod)}` : <span className="muted">—</span>}
                      </td>

                      <td style={tdStyle}>
                        {o.promo_code || o.promo_rule_title || Number(o.discount_jod || 0) > 0 || o.promotion_id || o.discount_source ? (
                          <div style={{ display: "grid", gap: 3 }}>
                            {o.promo_code ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  width: "fit-content",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(0,0,0,.12)",
                                }}
                              >
                                {o.promo_code}
                              </span>
                            ) : null}
                            {o.promo_rule_title ? (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {o.promo_rule_title}
                              </span>
                            ) : null}

                            {o.discount_source ? (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {isAr ? "المصدر:" : "Source:"} {o.discount_source}
                              </span>
                            ) : null}

                            {o.promotion_id ? (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {isAr ? "معرّف العرض:" : "Promotion ID:"} {o.promotion_id}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>

                      <td className="muted" style={{ ...tdStyle, fontSize: 13 }}>
                        {formatDate(o.created_at)}
                      </td>

                      {/* Order details: coming soon */}
                      <td style={tdStyle}>
                        <a
                          className="btn btn-outline"
                          href={`/${locale}/account/orders/${o.id}`}
                          style={{ padding: ".35rem .65rem", borderRadius: 10 }}
                        >
                          {t.details}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>
              {t.ordersEmpty}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}