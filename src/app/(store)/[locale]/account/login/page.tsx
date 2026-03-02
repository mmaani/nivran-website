"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { readJsonSafe } from "@/lib/http";
import { normalizeCartItems, readLocalCart, type CartItem, writeLocalCart } from "@/lib/cartStore";

type Locale = "en" | "ar";

type LoginOk = { ok: true; needsVerification?: boolean };
type LoginErr = { ok: false; error: string };
type LoginResponse = LoginOk | LoginErr;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asLoginResponse(v: unknown): LoginResponse | null {
  if (!isRecord(v)) return null;
  const ok = v["ok"];
  if (ok === true) {
    const needsVerification = v["needsVerification"];
    return { ok: true, needsVerification: typeof needsVerification === "boolean" ? needsVerification : undefined };
  }
  if (ok === false) {
    const error = v["error"];
    return { ok: false, error: typeof error === "string" ? error : "Login failed." };
  }
  return null;
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
      submitting: isAr ? "جاري تسجيل الدخول..." : "Signing in...",
      signup: isAr ? "إنشاء حساب جديد" : "Create account",
      forgot: isAr ? "نسيت كلمة المرور؟" : "Forgot password?",
      error: isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.",
      invalidCredentials: isAr ? "بيانات الدخول غير صحيحة." : "Invalid email or password.",
      tooManyAttempts: isAr ? "محاولات كثيرة. حاول لاحقًا." : "Too many attempts. Please try again later.",
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
      const normalizedEmail = email.trim().toLowerCase();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, locale, rememberMe }),
      });

      const raw: unknown = await readJsonSafe(res);
      const data = asLoginResponse(raw);

      if (!res.ok || !data) throw new Error(t.error);
      if (data.ok === false) {
        const code = data.error.trim().toUpperCase();
        if (code.includes("INVALID")) throw new Error(t.invalidCredentials);
        if (code.includes("TOO MANY") || res.status === 429) throw new Error(t.tooManyAttempts);
        throw new Error(data.error || t.error);
      }

      // cart sync
      const localItems = normalizeCartItems(readLocalCart());
      if (localItems.length) {
        const syncRes = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "merge", items: localItems }),
        });
        const syncRaw: unknown = await readJsonSafe(syncRes);
        if (isRecord(syncRaw) && syncRaw["ok"] === true && syncRaw["isAuthenticated"] === true && Array.isArray(syncRaw["items"])) {
          writeLocalCart(normalizeCartItems(syncRaw["items"] as CartItem[]));
        }
      }

      const needsVerification = data.needsVerification === true;
      window.location.href = needsVerification
        ? `/${locale}/account/verify?email=${encodeURIComponent(normalizedEmail)}`
        : `/${locale}/account`;
    } catch (e2: unknown) {
      const msg = e2 instanceof Error ? e2.message : t.error;
      setErr(msg || t.error);
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
            {loading ? t.submitting : t.submit}
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
