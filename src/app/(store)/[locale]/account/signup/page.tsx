"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { readLocalCart } from "@/lib/cartStore";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export default function SignupPage() {
  const params = useParams<{ locale?: string }>();
  const router = useRouter();

  const [locale, setLocale] = useState<Locale>("en");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loc = params?.locale === "ar" ? "ar" : "en";
    setLocale(loc);
  }, [params?.locale]);

  const can = useMemo(
    () => !!fullName.trim() && !!email.trim() && !!phone.trim() && !!addressLine1.trim() && !!password.trim(),
    [fullName, email, phone, addressLine1, password]
  );

  async function syncCartIfAny() {
    const items = readLocalCart();
    if (!items.length) return;

    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!can || busy) return;

    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        addressLine1,
        city,
        country,
        password,
      }),
    });

    const data: unknown = await res.json().catch(() => null);
    const ok = isRecord(data) && data.ok === true;

    if (!res.ok || !ok) {
      const apiError = isRecord(data) ? String(data.error ?? "") : "";
      setBusy(false);
      setError(apiError || t(locale, "Signup failed.", "فشل إنشاء الحساب."));
      return;
    }

    await syncCartIfAny();
    router.push(`/${locale}/account`);
    router.refresh();
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 560 }}>
      <h1 className="title">{t(locale, "Create account", "إنشاء حساب")}</h1>

      <form className="panel" onSubmit={submit}>
        <label>
          <span className="muted">{t(locale, "Full name *", "الاسم الكامل *")}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Email *", "البريد الإلكتروني *")}</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Phone *", "الهاتف *")}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Address *", "العنوان *")}</span>
          <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <label>
            <span className="muted">{t(locale, "City", "المدينة")}</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            <span className="muted">{t(locale, "Country", "الدولة")}</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </div>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Password *", "كلمة المرور *")}</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        {error ? <p style={{ color: "crimson", marginTop: 10 }}>{error}</p> : null}

        <button className={"btn" + (!can || busy ? " btn-disabled" : "")} disabled={!can || busy} style={{ marginTop: 12 }}>
          {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Create account", "إنشاء الحساب")}
        </button>

        <p className="muted" style={{ marginTop: 12 }}>
          {t(locale, "Already have an account?", "لديك حساب؟")}{" "}
          <Link href={`/${locale}/account/login`}>{t(locale, "Login", "تسجيل الدخول")}</Link>
        </p>
      </form>
    </div>
  );
}
