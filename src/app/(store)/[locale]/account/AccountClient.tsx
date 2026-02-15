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
  created_at: string;
};

type OrderRow = {
  id: number;
  cart_id: string;
  status: string;
  amount_jod: string;
  created_at: string;
};

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

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
        setErr(isAr ? "يرجى تسجيل الدخول." : "Please login.");
        setProfile(null);
        setOrders([]);
        setLoading(false);
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
  }, [isAr]);

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
      setErr(data?.error || (isAr ? "تعذر حفظ البيانات." : "Could not save profile."));
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

  if (loading) return <p className="muted">{isAr ? "جارٍ التحميل..." : "Loading..."}</p>;
  if (!profile)
    return (
      <div className="panel">
        <p className="muted">{err || (isAr ? "يرجى تسجيل الدخول." : "Please login.")}</p>
        <a className="btn" href={`/${locale}/account/login`}>
          {isAr ? "تسجيل الدخول" : "Login"}
        </a>
      </div>
    );

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="title" style={{ margin: 0 }}>
          {isAr ? "حسابي" : "My Account"}
        </h1>
        <button className="btn btn-outline" onClick={logout}>
          {isAr ? "تسجيل خروج" : "Logout"}
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>{isAr ? "البيانات الشخصية" : "Profile"}</h3>

        <div className="grid-2" style={{ gap: 10 }}>
          <label>
            <span className="muted">{isAr ? "الاسم الكامل *" : "Full name *"}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>

          <label>
            <span className="muted">{isAr ? "البريد الإلكتروني" : "Email"}</span>
            <input value={profile.email} readOnly />
          </label>

          <label>
            <span className="muted">{isAr ? "الهاتف *" : "Phone *"}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

          <label>
            <span className="muted">{isAr ? "الدولة" : "Country"}</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span className="muted">{isAr ? "العنوان *" : "Address *"}</span>
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span className="muted">{isAr ? "المدينة" : "City"}</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
        </div>

        {err ? <p style={{ color: "crimson", marginTop: 10 }}>{err}</p> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className={"btn" + (!canSave ? " btn-disabled" : "")} disabled={!canSave} onClick={saveProfile}>
            {isAr ? "حفظ" : "Save"}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>{isAr ? "الطلبات" : "Orders"}</h3>

        {orders.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? "الرقم" : "ID"}</th>
                  <th>{isAr ? "السلة" : "Cart"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th>{isAr ? "المبلغ" : "Amount"}</th>
                  <th>{isAr ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.cart_id}</td>
                    <td>{o.status}</td>
                    <td>{Number(o.amount_jod || 0).toFixed(2)} JOD</td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{isAr ? "لا توجد طلبات بعد." : "No orders yet."}</p>
        )}
      </div>
    </div>
  );
}
