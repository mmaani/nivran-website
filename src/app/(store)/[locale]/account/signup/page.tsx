"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CART_LOCAL_KEY } from "@/lib/cartStore";
import { isRecord, readErrorMessage } from "@/lib/http-client";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

type CartLocalItem = { slug: string; qty: number };

function isCartLocalItem(v: unknown): v is CartLocalItem {
  if (!isRecord(v)) return false;
  return typeof v.slug === "string" && typeof v.qty === "number" && Number.isFinite(v.qty);
}

function readLocalCart(): CartLocalItem[] {
  try {
    const raw = localStorage.getItem(CART_LOCAL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLocalItem).map((x) => ({ slug: x.slug, qty: Math.max(0, Math.floor(x.qty)) }));
  } catch {
    return [];
  }
}

type SignupResponse = { ok?: boolean; error?: string };

export default function SignupPage() {
  const p = useParams<{ locale?: string }>();
  const locale: Locale = p?.locale === "ar" ? "ar" : "en";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const can = useMemo(
    () => !!fullName.trim() && !!email.trim() && !!phone.trim() && !!addressLine1.trim() && !!password.trim(),
    [fullName, email, phone, addressLine1, password]
  );

  async function syncCartIfAny() {
    const items = readLocalCart();
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!can || busy) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, addressLine1, city, country, password }),
      });

      if (!res.ok) {
        setError(await readErrorMessage(res, t(locale, "Signup failed.", "فشل إنشاء الحساب.")));
        return;
      }

      const raw: unknown = await res.json().catch(() => null);
      const d: SignupResponse = isRecord(raw) ? (raw as SignupResponse) : {};
      if (!d.ok) {
        setError(d.error || t(locale, "Signup failed.", "فشل إنشاء الحساب."));
        return;
      }

      await syncCartIfAny();
      window.location.href = `/${locale}/account`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-shell" dir={locale === "ar" ? "rtl" : "ltr"} style={{ padding: "1.4rem 0" }}>
      <div className="panel auth-card" style={{ width: "min(760px, 100%)", padding: "1.2rem" }}>
        <p className="kicker">{t(locale, "NIVRAN Account", "حساب NIVRAN")}</p>
        <h1 className="title" style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", marginTop: ".6rem" }}>
          {t(locale, "Create account", "إنشاء حساب")}
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {t(locale, "Save your details for faster checkout and order tracking.", "احفظ بياناتك لتسريع الدفع ومتابعة الطلبات.")}
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 12 }} aria-busy={busy}>
          <label>
            <span className="muted">{t(locale, "Full name *", "الاسم الكامل *")}</span>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>

          <div className="grid-2">
            <label>
              <span className="muted">{t(locale, "Email *", "البريد الإلكتروني *")}</span>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <label>
              <span className="muted">{t(locale, "Phone *", "الهاتف *")}</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
          </div>

          <label>
            <span className="muted">{t(locale, "Address *", "العنوان *")}</span>
            <input className="input" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
          </label>

          <div className="grid-2">
            <label>
              <span className="muted">{t(locale, "City", "المدينة")}</span>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label>
              <span className="muted">{t(locale, "Country", "الدولة")}</span>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>
          </div>

          <label>
            <span className="muted">{t(locale, "Password *", "كلمة المرور *")}</span>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>

          {error ? <p style={{ color: "#b42318", margin: 0 }}>{error}</p> : null}

          <button className="btn primary" disabled={!can || busy} style={{ marginTop: 2 }}>
            {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Create account", "إنشاء الحساب")}
          </button>

          <p className="muted" style={{ margin: 0 }}>
            {t(locale, "Already have an account?", "لديك حساب؟")} <a href={`/${locale}/account/login`}>{t(locale, "Login", "تسجيل الدخول")}</a>
          </p>
        </form>
      </div>
    </section>
  );
}
