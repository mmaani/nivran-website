"use client";

import { useEffect, useMemo, useState } from "react";

type Order = { id: number; cart_id: string; status: string; amount: string; created_at: string };

type Profile = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  locale: "en" | "ar";
};

export default function AccountClient({ locale }: { locale: "en" | "ar" }) {
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pending, setPending] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  const t = useMemo(() => ({
    title: isAr ? "حسابي" : "My account",
    unauth: isAr ? "يجب تسجيل الدخول أولاً" : "Please login first",
    save: isAr ? "حفظ التحديثات" : "Save updates",
    remove: isAr ? "حذف الحساب" : "Delete profile",
    pending: isAr ? "الطلبات المعلّقة" : "Pending items",
    history: isAr ? "سجل المشتريات" : "Purchase history",
  }), [isAr]);

  async function load() {
    const res = await fetch("/api/auth/profile", { cache: "no-store" });
    const data = await res.json();
    if (data?.ok) {
      setProfile(data.profile);
      setOrders(data.orders || []);
      setPending(data.pending || []);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: String(fd.get("first_name") || ""),
      lastName: String(fd.get("last_name") || ""),
      phone: String(fd.get("phone") || ""),
      locale: String(fd.get("locale") || locale),
      password: String(fd.get("password") || ""),
    };
    const res = await fetch("/api/auth/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setMessage(data?.ok ? (isAr ? "تم الحفظ" : "Saved") : data?.error || "Error");
    if (data?.ok) await load();
  }

  async function deleteProfile() {
    const ok = window.confirm(isAr ? "هل أنت متأكد من حذف الحساب؟" : "Are you sure you want to delete your profile?");
    if (!ok) return;
    const res = await fetch("/api/auth/profile", { method: "DELETE" });
    const data = await res.json();
    if (data?.ok) {
      window.location.href = `/${locale}`;
    }
  }

  if (loading) return <p>{isAr ? "جاري التحميل..." : "Loading..."}</p>;
  if (!profile) return <p>{t.unauth} — <a href={`/${locale}/account/login`} style={{ textDecoration: "underline" }}>{isAr ? "تسجيل الدخول" : "Login"}</a></p>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h1 className="title" style={{ marginBottom: 0 }}>{t.title}</h1>
      <section className="panel">
        <form onSubmit={updateProfile} style={{ display: "grid", gap: 8 }}>
          <input className="input" disabled value={profile.email} />
          <input className="input" name="first_name" defaultValue={profile.first_name || ""} placeholder={isAr ? "الاسم الأول" : "First name"} />
          <input className="input" name="last_name" defaultValue={profile.last_name || ""} placeholder={isAr ? "اسم العائلة" : "Last name"} />
          <input className="input" name="phone" defaultValue={profile.phone || ""} placeholder={isAr ? "رقم الهاتف" : "Phone"} />
          <select className="input" name="locale" defaultValue={profile.locale || locale}><option value="en">English</option><option value="ar">العربية</option></select>
          <input className="input" name="password" type="password" minLength={8} placeholder={isAr ? "كلمة مرور جديدة (اختياري)" : "New password (optional)"} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" type="submit">{t.save}</button>
            <button className="btn" type="button" onClick={deleteProfile}>{t.remove}</button>
          </div>
          {message && <p style={{ margin: 0 }}>{message}</p>}
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>{t.pending}</h2>
        {pending.length === 0 ? <p className="muted">{isAr ? "لا يوجد" : "No pending items"}</p> : (
          <ul>{pending.map((o) => <li key={o.id}>{o.cart_id} — {o.status} — {o.amount} JOD</li>)}</ul>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>{t.history}</h2>
        {orders.length === 0 ? <p className="muted">{isAr ? "لا يوجد" : "No purchases yet"}</p> : (
          <ul>{orders.map((o) => <li key={o.id}>{new Date(o.created_at).toLocaleDateString()} — {o.cart_id} — {o.status} — {o.amount} JOD</li>)}</ul>
        )}
      </section>
    </div>
  );
}
