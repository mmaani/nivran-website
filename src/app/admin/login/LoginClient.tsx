"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Lang = "en" | "ar";

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function useAdminLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  React.useEffect(() => {
    const v = getCookie("admin_lang");
    setLang(v === "ar" ? "ar" : "en");
  }, []);
  return lang;
}

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const lang = useAdminLang();

  const t =
    lang === "ar"
      ? {
          title: "تسجيل دخول الإدارة",
          desc: "أدخل رمز الإدارة للوصول إلى لوحة التحكم. يتم ضبط الرمز في Vercel باسم ADMIN_TOKEN.",
          tokenLabel: "رمز الإدارة",
          tokenPlaceholder: "ADMIN_TOKEN",
          signingIn: "جارٍ تسجيل الدخول…",
          signIn: "دخول",
          errorPrefix: "خطأ: ",
        }
      : {
          title: "Admin Login",
          desc: "Enter the admin token to access the dashboard. Token value is set in Vercel as ADMIN_TOKEN.",
          tokenLabel: "ADMIN_TOKEN",
          tokenPlaceholder: "ADMIN_TOKEN",
          signingIn: "Signing in…",
          signIn: "Sign in",
          errorPrefix: "Error: ",
        };

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const safeNext = useMemo(() => {
    if (!nextPath || typeof nextPath !== "string") return "/admin/orders";
    if (!nextPath.startsWith("/")) return "/admin/orders";
    if (nextPath.startsWith("//")) return "/admin/orders";
    return nextPath;
  }, [nextPath]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Login failed");
      router.replace(safeNext);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="admin-content">
        <div className="admin-card admin-grid" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 className="admin-h1">{t.title}</h1>

          <p className="admin-muted">{t.desc}</p>

          <form onSubmit={submit} className="admin-grid">
            <div>
              <div className="admin-label" style={{ marginBottom: 6 }}>
                {t.tokenLabel}
              </div>
              <input
                className="admin-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t.tokenPlaceholder}
                autoComplete="off"
                spellCheck={false}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading || !token.trim()}>
              {loading ? t.signingIn : t.signIn}
            </button>

            {err ? (
              <div style={{ color: "crimson" }}>
                {t.errorPrefix}
                {err}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
