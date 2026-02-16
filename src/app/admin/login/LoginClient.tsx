"use client";

import React, { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readErrorMessage } from "@/lib/http-client";

type Lang = "en" | "ar";

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function useAdminLang(): [Lang, (next: Lang) => Promise<void>] {
  const [lang, setLang] = useState<Lang>("en");
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    const v = getCookie("admin_lang");
    setLang(v === "ar" ? "ar" : "en");
  }, []);

  async function updateLang(next: Lang) {
    setLang(next);
    await fetch("/api/admin/lang", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lang: next, next: pathname }),
    });
    router.refresh();
  }

  return [lang, updateLang];
}

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [lang, setLang] = useAdminLang();

  const t =
    lang === "ar"
      ? {
          title: "تسجيل دخول الإدارة",
          desc: "دخول آمن للوصول إلى لوحة التحكم وإدارة الطلبات والمحتوى.",
          sideTitle: "NIVRAN Admin",
          points: ["وصول آمن للطلبات والعملاء", "جلسة محمية عبر ملفات تعريف الارتباط", "دعم ثنائي اللغة داخل لوحة التحكم"],
          tokenLabel: "رمز الإدارة",
          tokenPlaceholder: "ADMIN_TOKEN",
          show: "إظهار",
          hide: "إخفاء",
          signingIn: "جارٍ تسجيل الدخول…",
          signIn: "دخول",
          help: "تأكد من مطابقة ADMIN_TOKEN في البيئة وعدم وجود مسافات إضافية.",
          errorPrefix: "خطأ: ",
          redirecting: "سيتم توجيهك إلى:",
          switchLang: "التبديل إلى الإنجليزية",
        }
      : {
          title: "Admin Login",
          desc: "Secure access to manage orders, catalog, and operations.",
          sideTitle: "NIVRAN Admin",
          points: ["Protected access for orders and customer operations", "Cookie-based secure admin session", "Bilingual admin workflow support"],
          tokenLabel: "Admin token",
          tokenPlaceholder: "ADMIN_TOKEN",
          show: "Show",
          hide: "Hide",
          signingIn: "Signing in…",
          signIn: "Sign in",
          help: "Make sure ADMIN_TOKEN matches your environment value with no extra spaces.",
          errorPrefix: "Error: ",
          redirecting: "You'll be redirected to:",
          switchLang: "Switch to Arabic",
        };

  const [token, setToken] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const safeNext = useMemo(() => {
    if (!nextPath || typeof nextPath !== "string") return "/admin";
    if (!nextPath.startsWith("/")) return "/admin";
    if (nextPath.startsWith("//")) return "/admin";
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

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, lang === "ar" ? "فشل تسجيل الدخول" : "Login failed"));
      }

      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
        throw new Error(lang === "ar" ? "فشل تسجيل الدخول" : "Login failed");
      }

      router.replace(safeNext);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e || "");
      setErr(msg || (lang === "ar" ? "فشل تسجيل الدخول" : "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-card admin-login-card">
      <div className="admin-login-layout">
        <aside className="admin-login-side">
          <p className="admin-muted" style={{ textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>
            {t.sideTitle}
          </p>
          <h1 className="admin-h1" style={{ marginTop: 12 }}>
            {t.title}
          </h1>
          <p className="admin-muted">{t.desc}</p>
          <ul>
            {t.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </aside>

        <form onSubmit={submit} className="admin-login-form" aria-busy={loading}>
          <div className="admin-row" style={{ justifyContent: "space-between" }}>
            <p className="admin-login-note" style={{ margin: 0 }}>
              {t.redirecting} <span className="mono">{safeNext}</span>
            </p>
            <button type="button" className="btn" onClick={() => setLang(lang === "en" ? "ar" : "en")} title={t.switchLang}>
              {lang === "en" ? "AR" : "EN"}
            </button>
          </div>

          <div>
            <label htmlFor="admin-token-input" className="admin-label" style={{ marginBottom: 6, display: "block" }}>
              {t.tokenLabel}
            </label>

            <div style={{ position: "relative" }}>
              <input
                id="admin-token-input"
                className="admin-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t.tokenPlaceholder}
                autoComplete="off"
                spellCheck={false}
                type={reveal ? "text" : "password"}
                aria-invalid={!!err}
                style={{ width: "100%", paddingInlineEnd: 80, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => setReveal((v) => !v)}
                style={{ position: "absolute", top: 6, insetInlineEnd: 6, padding: ".35rem .65rem" }}
              >
                {reveal ? t.hide : t.show}
              </button>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading || !token.trim()}>
            {loading ? t.signingIn : t.signIn}
          </button>

          <p className="admin-login-note">{t.help}</p>

          {err ? (
            <div style={{ color: "#b42318" }} role="alert">
              {t.errorPrefix}
              {err}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
