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
  created_at: string;
};

function formatJod(v: string) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0.00 JOD";
  return `${n.toFixed(2)} JOD`;
}

function shortCartId(id: string) {
  const s = String(id || "");
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

function statusLabel(statusRaw: string) {
  const s = String(statusRaw || "").trim().toUpperCase();
  return s || "—";
}

function statusTone(statusRaw: string): { bg: string; fg: string; bd: string } {
  const s = statusLabel(statusRaw);
  // keep it neutral + calm. Don’t use loud colors.
  if (s.includes("DELIVER")) return { bg: "rgba(27,27,27,.06)", fg: "#1B1B1B", bd: "rgba(27,27,27,.18)" };
  if (s.includes("SHIP")) return { bg: "rgba(201,164,106,.12)", fg: "#5a451f", bd: "rgba(201,164,106,.45)" };
  if (s.includes("PROCESS")) return { bg: "rgba(27,27,27,.06)", fg: "#1B1B1B", bd: "rgba(27,27,27,.18)" };
  if (s.includes("PENDING")) return { bg: "rgba(201,164,106,.10)", fg: "#5a451f", bd: "rgba(201,164,106,.35)" };
  if (s.includes("FAIL") || s.includes("CANCEL")) return { bg: "rgba(0,0,0,.06)", fg: "#444", bd: "rgba(0,0,0,.18)" };
  return { bg: "rgba(0,0,0,.05)", fg: "#333", bd: "rgba(0,0,0,.14)" };
}

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");

  const canSave = useMemo(() => {
    return !!fullName.trim() && !!phone.trim() && !!addressLine1.trim();
  }, [fullName, phone, addressLine1]);

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
      setOrders(Array.isArray(data.orders) ? data.orders : []);

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
    if (!canSave || saving) return;
    setErr(null);
    setSaving(true);

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

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setErr(data?.error || (isAr ? "تعذر حفظ البيانات." : "Could not save profile."));
        return;
      }

      const r = await fetch("/api/auth/profile", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) setProfile(d.profile);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = `/${locale}/`;
  }

  const pageDir = isAr ? "rtl" : "ltr";

  if (loading) return <p className="muted">{isAr ? "جارٍ التحميل..." : "Loading..."}</p>;

  if (!profile) {
    return (
      <div className="panel" dir={pageDir}>
        <p className="muted">{err || (isAr ? "يرجى تسجيل الدخول." : "Please login.")}</p>
        <a className="btn" href={`/${locale}/account/login`}>
          {isAr ? "تسجيل الدخول" : "Login"}
        </a>
      </div>
    );
  }

  const verified = !!profile.email_verified_at;

  return (
    <div dir={pageDir} style={{ padding: "1.2rem 0", maxWidth: 980, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            {isAr ? "حسابي" : "My Account"}
          </h1>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
            {isAr ? "إدارة بياناتك وطلباتك." : "Manage your profile and orders."}
          </div>
        </div>

        <button className="btn btn-outline" onClick={logout}>
          {isAr ? "تسجيل خروج" : "Logout"}
        </button>
      </div>

      {/* Verify banner (single, not duplicated) */}
      {!verified ? (
        <div className="panel" style={{ border: "1px solid rgba(201,164,106,.45)", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800 }}>
                {isAr ? "بريدك غير مُؤكَّد" : "Email not verified"}
              </div>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                {isAr
                  ? "أكد بريدك لتأمين حسابك واستلام تحديثات الطلبات."
                  : "Verify your email to secure your account and receive order updates."}
              </div>
            </div>

            <a className="btn" href={`/${locale}/account/verify?email=${encodeURIComponent(profile.email)}`}>
              {isAr ? "تأكيد الآن" : "Verify now"}
            </a>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{isAr ? "تم تأكيد البريد الإلكتروني" : "Email verified"}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {isAr ? "حسابك جاهز لاستلام تحديثات الطلبات." : "Your account can receive order updates."}
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,.12)",
                background: "rgba(27,27,27,.04)",
              }}
            >
              {isAr ? "مؤكد" : "Verified"}
            </span>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 14, alignItems: "start" }}>
        {/* Profile card */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>{isAr ? "ملفك الشخصي" : "Your profile"}</h3>
            <div className="muted" style={{ fontSize: 12 }}>
              {isAr ? "الحقول المطلوبة *" : "Required fields *"}
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="grid-2" style={{ gap: 10 }}>
            <label>
              <span className="muted">{isAr ? "الاسم الكامل *" : "Full name *"}</span>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isAr ? "مثال: محمد المعاني" : "e.g. Mohammad Maani"}
              />
            </label>

            <label>
              <span className="muted">
                {isAr ? "البريد الإلكتروني" : "Email"}{" "}
                <span
                  style={{
                    marginInlineStart: 8,
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: verified ? "1px solid rgba(0,0,0,.12)" : "1px solid rgba(201,164,106,.45)",
                    background: verified ? "rgba(27,27,27,.04)" : "rgba(201,164,106,.10)",
                  }}
                >
                  {verified ? (isAr ? "مؤكد" : "Verified") : isAr ? "غير مؤكد" : "Unverified"}
                </span>
              </span>
              <input className="input" value={profile.email} readOnly />
            </label>

            <label>
              <span className="muted">{isAr ? "الهاتف *" : "Phone *"}</span>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isAr ? "رقم الهاتف" : "Phone number"}
              />
            </label>

            <label>
              <span className="muted">{isAr ? "الدولة" : "Country"}</span>
              <input
                className="input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={isAr ? "الدولة" : "Country"}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted">{isAr ? "العنوان *" : "Address *"}</span>
              <input
                className="input"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder={isAr ? "العنوان" : "Address line"}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="muted">{isAr ? "المدينة" : "City"}</span>
              <input
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={isAr ? "المدينة" : "City"}
              />
            </label>
          </div>

          {err ? <p style={{ color: "crimson", marginTop: 10, marginBottom: 0 }}>{err}</p> : null}

          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button className={"btn" + (!canSave ? " btn-disabled" : "")} disabled={!canSave || saving} onClick={saveProfile}>
              {saving ? (isAr ? "جارٍ الحفظ…" : "Saving…") : isAr ? "حفظ" : "Save"}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              {isAr ? "سيتم تحديث بياناتك فوراً." : "Your details update immediately."}
            </span>
          </div>
        </div>

        {/* Orders card */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>{isAr ? "الطلبات" : "Orders"}</h3>
            <div className="muted" style={{ fontSize: 12 }}>
              {orders.length ? `${orders.length}` : isAr ? "لا يوجد" : "None"}
            </div>
          </div>

          <div style={{ height: 10 }} />

          {orders.length ? (
            <div style={{ overflowX: "auto" }}>
              <table
                className="table"
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "start", padding: "10px 10px" }}>{isAr ? "الرقم" : "ID"}</th>
                    <th style={{ textAlign: "start", padding: "10px 10px" }}>{isAr ? "السلة" : "Cart"}</th>
                    <th style={{ textAlign: "start", padding: "10px 10px" }}>{isAr ? "الحالة" : "Status"}</th>
                    <th style={{ textAlign: "start", padding: "10px 10px" }}>{isAr ? "المبلغ" : "Amount"}</th>
                    <th style={{ textAlign: "start", padding: "10px 10px" }}>{isAr ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const tone = statusTone(o.status);
                    return (
                      <tr key={o.id} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>{o.id}</td>

                        <td style={{ padding: "10px 10px", maxWidth: 220 }}>
                          <span
                            title={o.cart_id}
                            style={{
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                              fontSize: 12,
                              color: "#333",
                            }}
                          >
                            {shortCartId(o.cart_id)}
                          </span>
                        </td>

                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: `1px solid ${tone.bd}`,
                              background: tone.bg,
                              color: tone.fg,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {statusLabel(o.status)}
                          </span>
                        </td>

                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap", fontWeight: 700 }}>
                          {formatJod(o.amount_jod)}
                        </td>

                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                          <span className="muted">{new Date(o.created_at).toLocaleString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
                {isAr
                  ? "لمشاهدة تفاصيل الطلب (قريباً): سنضيف صفحة تفاصيل لكل طلب."
                  : "Order details (coming soon): we can add a details page per order."}
              </div>
            </div>
          ) : (
            <div className="muted" style={{ lineHeight: 1.6 }}>
              {isAr ? "لا توجد طلبات بعد." : "No orders yet."}
            </div>
          )}
        </div>
      </div>

      {/* Responsive tweak without CSS file */}
      <style>{`
        @media (max-width: 920px) {
          .account-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}