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
  cart_id: string | null;
  status: string;
  amount_jod: string;
  created_at: string;
};

function moneyJod(v: string | number): string {
  const n = typeof v === "number" ? v : Number(v || 0);
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)} JOD`;
}

function fmtDate(d: string, locale: string): string {
  try {
    return new Date(d).toLocaleString(locale === "ar" ? "ar-JO" : "en-US");
  } catch {
    return d;
  }
}

function statusLabel(s: string): { text: string; tone: "neutral" | "good" | "warn" | "bad" } {
  const v = String(s || "").toUpperCase();
  if (v.includes("DELIVER")) return { text: v, tone: "good" };
  if (v.includes("SHIP") || v.includes("PROCESS")) return { text: v, tone: "neutral" };
  if (v.includes("PENDING")) return { text: v, tone: "warn" };
  if (v.includes("FAIL") || v.includes("CANCEL")) return { text: v, tone: "bad" };
  return { text: v || "—", tone: "neutral" };
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "neutral" | "good" | "warn" | "bad" }) {
  const b =
    tone === "good"
      ? "rgba(24,160,88,.18)"
      : tone === "warn"
        ? "rgba(201,164,106,.22)"
        : tone === "bad"
          ? "rgba(220,20,60,.16)"
          : "rgba(0,0,0,.08)";

  const br =
    tone === "good"
      ? "rgba(24,160,88,.35)"
      : tone === "warn"
        ? "rgba(201,164,106,.45)"
        : tone === "bad"
          ? "rgba(220,20,60,.35)"
          : "rgba(0,0,0,.12)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 999,
        border: `1px solid ${br}`,
        background: b,
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      title: isAr ? "حسابي" : "My Account",
      logout: isAr ? "تسجيل خروج" : "Logout",
      loading: isAr ? "جارٍ التحميل..." : "Loading...",
      login: isAr ? "تسجيل الدخول" : "Login",
      needLogin: isAr ? "يرجى تسجيل الدخول." : "Please login.",
      profile: isAr ? "ملفك الشخصي" : "Your profile",
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
      orders: isAr ? "الطلبات" : "Orders",
      noOrders: isAr ? "لا توجد طلبات بعد." : "No orders yet.",
      id: isAr ? "الرقم" : "ID",
      cart: isAr ? "السلة" : "Cart",
      status: isAr ? "الحالة" : "Status",
      amount: isAr ? "المبلغ" : "Amount",
      date: isAr ? "التاريخ" : "Date",
      detailsSoon: isAr ? "تفاصيل الطلب (قريباً)" : "Order details (coming soon)",
      emailNotVerifiedTitle: isAr ? "بريدك غير مُؤكَّد" : "Email not verified",
      emailNotVerifiedBody: isAr
        ? "أكد بريدك لتأمين حسابك واستلام تحديثات الطلبات."
        : "Verify your email to secure your account and receive order updates.",
      verifyNow: isAr ? "تأكيد الآن" : "Verify now",
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

  const canSave = useMemo(
    () => !!fullName.trim() && !!phone.trim() && !!addressLine1.trim(),
    [fullName, phone, addressLine1]
  );

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
        <p className="muted">{err || t.needLogin}</p>
        <a className="btn" href={`/${locale}/account/login`}>
          {t.login}
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 14px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <h1 className="title" style={{ margin: 0 }}>
              {t.title}
            </h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {profile.email}
            </div>
          </div>

          <button className="btn btn-outline" onClick={logout}>
            {t.logout}
          </button>
        </div>

        {/* Email verify */}
        {!profile.email_verified_at ? (
          <div className="panel" style={{ marginTop: 14, border: "1px solid rgba(201,164,106,.45)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{t.emailNotVerifiedTitle}</div>
                <div className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
                  {t.emailNotVerifiedBody}
                </div>
              </div>
              <a className="btn" href={`/${locale}/account/verify?email=${encodeURIComponent(profile.email)}`}>
                {t.verifyNow}
              </a>
            </div>
          </div>
        ) : null}

        {/* Two-column layout */}
        <div className="grid-2" style={{ gap: 14, marginTop: 14, alignItems: "start" }}>
          {/* Profile card */}
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>{t.profile}</h3>
              <Badge tone={profile.email_verified_at ? "good" : "warn"}>{profile.email_verified_at ? t.verified : t.unverified}</Badge>
            </div>

            <div style={{ height: 10 }} />

            <div className="grid-2" style={{ gap: 10 }}>
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

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className={"btn" + (!canSave ? " btn-disabled" : "")} disabled={!canSave} onClick={saveProfile}>
                {t.save}
              </button>
            </div>
          </div>

          {/* Orders card */}
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>{t.orders}</h3>

            {orders.length ? (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>{t.id}</th>
                      <th style={{ width: 260 }}>{t.cart}</th>
                      <th style={{ width: 160 }}>{t.status}</th>
                      <th style={{ width: 140 }}>{t.amount}</th>
                      <th style={{ width: 190 }}>{t.date}</th>
                      <th style={{ width: 220 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const st = statusLabel(o.status);
                      return (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 700 }}>{o.id}</td>
                          <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
                            {o.cart_id || "—"}
                          </td>
                          <td>
                            <Badge tone={st.tone}>{st.text}</Badge>
                          </td>
                          <td style={{ fontWeight: 700 }}>{moneyJod(o.amount_jod)}</td>
                          <td className="muted">{fmtDate(o.created_at, locale)}</td>
                          <td style={{ textAlign: "end" }}>
                            <button className="btn btn-outline" disabled title={t.detailsSoon}>
                              {t.detailsSoon}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ marginBottom: 0 }}>
                {t.noOrders}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
