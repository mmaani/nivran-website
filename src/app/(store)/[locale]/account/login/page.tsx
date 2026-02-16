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
      title: isAr ? "تسجيل الدخول" : "Login",
      email: isAr ? "البريد الإلكتروني" : "Email",
      password: isAr ? "كلمة المرور" : "Password",
      submit: isAr ? "دخول" : "Sign in",
      signup: isAr ? "إنشاء حساب" : "Create account",
      error: isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.",
    }),
    [isAr]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password, locale }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || t.error);

      // After login, sync local cart to account (DB)
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
    <div style={{ padding: "1.2rem 0", maxWidth: 520 }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {t.title}
      </h1>

      <section className="panel">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password}
          />
          {err ? <p style={{ color: "crimson", margin: 0 }}>{err}</p> : null}
          <button className="btn primary" disabled={loading}>
            {t.submit}
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
