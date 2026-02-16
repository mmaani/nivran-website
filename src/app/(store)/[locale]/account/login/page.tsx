"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Locale = "en" | "ar";
type CartItem = { slug: string; name: string; priceJod: number; qty: number };

const CART_KEY = "nivran_cart_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: Record<string, unknown>) => ({
        slug: String(x?.slug || "").trim(),
        name: String(x?.name || "").trim(),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Number(x?.qty || 1)),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("nivran_cart_updated"));
}

export default function LoginPage() {
  const p = useParams<{ locale?: string }>();
  const locale: Locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      title: isAr ? "مرحباً بعودتك" : "Welcome back",
      subtitle: isAr ? "سجّل الدخول لإدارة طلباتك وعناوينك بسرعة." : "Sign in to manage orders, addresses, and checkout faster.",
      email: isAr ? "البريد الإلكتروني" : "Email",
      password: isAr ? "كلمة المرور" : "Password",
      remember: isAr ? "تذكّرني" : "Remember me",
      showPassword: isAr ? "إظهار" : "Show",
      hidePassword: isAr ? "إخفاء" : "Hide",
      submit: isAr ? "دخول" : "Sign in",
      signup: isAr ? "إنشاء حساب جديد" : "Create account",
      forgot: isAr ? "نسيت كلمة المرور؟" : "Forgot password?",
      error: isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.",
    }),
    [isAr]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, locale, rememberMe }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || t.error);

      const localItems = readCart();
      if (localItems.length) {
        const syncRes = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "merge", items: localItems }),
        });
        const syncData = await syncRes.json().catch(() => null);
        if (syncData?.ok && syncData?.isAuthenticated && Array.isArray(syncData.items)) {
          writeCart(syncData.items);
        }
      }

      window.location.href = `/${locale}/account`;
    } catch (e: unknown) {
      setErr((e as Error)?.message || t.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell" style={{ padding: "1.2rem 0" }}>
      <section className="auth-card panel" dir={isAr ? "rtl" : "ltr"}>
        <h1 className="title" style={{ marginTop: 0, marginBottom: 8 }}>
          {t.title}
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {t.subtitle}
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.email}
            type="email"
            autoComplete="email"
            required
          />

          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.password}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="btn"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", top: 6, insetInlineEnd: 6, padding: ".35rem .65rem", borderRadius: 9 }}
            >
              {showPassword ? t.hidePassword : t.showPassword}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span className="muted">{t.remember}</span>
            </label>

            <a href={`/${locale}/account/forgot-password`} style={{ textDecoration: "underline" }}>
              {t.forgot}
            </a>
          </div>

          {err ? <p style={{ color: "crimson", margin: 0 }}>{err}</p> : null}

          <button className="btn primary" disabled={loading}>
            {loading ? "…" : t.submit}
          </button>

          <div style={{ marginTop: 6 }}>
            <a href={`/${locale}/account/signup`} style={{ textDecoration: "underline" }}>
              {t.signup}
            </a>
          </div>
        </form>
      </section>
    </div>
  );
}
