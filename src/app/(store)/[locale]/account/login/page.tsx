"use client";
import { useEffect, useMemo, useState } from "react";
import { CART_LOCAL_KEY } from "@/lib/cartStore";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function readLocalCart() {
  try {
    const raw = localStorage.getItem(CART_LOCAL_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState<Locale>("en");
  const isAr = locale === "ar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setLocale(p.locale === "ar" ? "ar" : "en"));
  }, [params]);

  const can = useMemo(() => !!email.trim() && !!password.trim(), [email, password]);

  async function syncCartIfAny() {
    const items = readLocalCart();
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  async function submit(e: any) {
    e.preventDefault();
    if (!can || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setBusy(false);
      setError(data?.error || t(locale, "Login failed.", "فشل تسجيل الدخول."));
      return;
    }

    // Merge local cart into account cart
    await syncCartIfAny();

    // Optional ?next=
    const qs = new URLSearchParams(window.location.search);
    const next = qs.get("next");
    window.location.href = next || `/${locale}/account`;
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 520 }}>
      <h1 className="title">{t(locale, "Login", "تسجيل الدخول")}</h1>
      <form className="panel" onSubmit={submit}>
        <label>
          <span className="muted">{t(locale, "Email", "البريد الإلكتروني")}</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Password", "كلمة المرور")}</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        {error ? <p style={{ color: "crimson", marginTop: 10 }}>{error}</p> : null}

        <button className={"btn" + (!can || busy ? " btn-disabled" : "")} disabled={!can || busy} style={{ marginTop: 12 }}>
          {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Login", "تسجيل الدخول")}
        </button>

        <p className="muted" style={{ marginTop: 12 }}>
          {t(locale, "No account?", "لا تملك حساباً؟")}{" "}
          <a href={`/${locale}/account/signup`}>{t(locale, "Create one", "إنشاء حساب")}</a>
        </p>
      </form>
    </div>
  );
}
