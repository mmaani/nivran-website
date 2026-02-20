"use client";

import React, { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { readErrorMessage } from "@/lib/http-client";
import { adminFetch, readAdminLangCookie } from "@/app/admin/_components/adminClient";

type Lang = "en" | "ar";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function useAdminLang(): [Lang, (next: Lang) => Promise<void>] {
  const [lang, setLang] = useState<Lang>("en");
  const pathname = usePathname();

  React.useEffect(() => {
    setLang(readAdminLangCookie());
  }, []);

  async function updateLang(next: Lang) {
    setLang(next);
    await fetch("/api/admin/lang", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lang: next, next: pathname }),
      cache: "no-store",
    }).catch(() => null);
    // No need to router.refresh here — login uses full navigation anyway.
  }

  return [lang, updateLang];
}

export default function LoginClient({ nextPath }: { nextPath: string }) {
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
          paste: "لصق",
          clear: "مسح",
          signingIn: "جارٍ تسجيل الدخول…",
          signIn: "دخول",
          help: "تأكد من مطابقة ADMIN_TOKEN في البيئة وعدم وجود مسافات إضافية. ستبقى الجلسة فعالة بين صفحات الإدارة في هذا المتصفح.",
          errorPrefix: "خطأ: ",
          switchLang: "التبديل إلى الإنجليزية",
          secureNote: "جلسة آمنة عبر Cookie",
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
          paste: "Paste",
          clear: "Clear",
          signingIn: "Signing in…",
          signIn: "Sign in",
          help: "Make sure ADMIN_TOKEN matches your environment value with no extra spaces. Your session stays active across admin sections on this browser.",
          errorPrefix: "Error: ",
          switchLang: "Switch to Arabic",
          secureNote: "Secure cookie session",
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

  async function onPasteToken() {
    try {
      const text = await navigator.clipboard.readText();
      const next = typeof text === "string" ? text.trim() : "";
      if (next) setToken(next);
    } catch {
      // ignore
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const trimmed = token.trim();
    if (!trimmed) {
      setErr(lang === "ar" ? "يرجى إدخال الرمز" : "Please enter the token");
      return;
    }

    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, lang === "ar" ? "فشل تسجيل الدخول" : "Login failed"));
      }

      const data: unknown = await res.json().catch(() => null);
      if (!isRecord(data) || data["ok"] !== true) {
        throw new Error(lang === "ar" ? "فشل تسجيل الدخول" : "Login failed");
      }

      // ✅ Most reliable: full navigation so server components see the new cookie immediately
      window.location.assign(safeNext);
      return;
    } catch (eUnknown: unknown) {
      const msg = eUnknown instanceof Error ? eUnknown.message : String(eUnknown || "");
      setErr(msg || (lang === "ar" ? "فشل تسجيل الدخول" : "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-card admin-login-card" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <div className="admin-login-layout">
        <aside className="admin-login-side">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <p className="admin-muted" style={{ textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800, margin: 0 }}>
              {t.sideTitle}
            </p>

            <span
              className="badge"
              style={{
                background: "rgba(255,255,255,.10)",
                borderColor: "rgba(255,255,255,.18)",
                color: "rgba(255,255,255,.88)",
                fontWeight: 800,
              }}
              title={t.secureNote}
            >
              🔒 {t.secureNote}
            </span>
          </div>

          <h1 className="admin-h1" style={{ marginTop: 14, color: "#fff" }}>
            {t.title}
          </h1>
          <p className="admin-muted" style={{ color: "rgba(255,255,255,.82)" }}>
            {t.desc}
          </p>

          <ul style={{ marginTop: 16 }}>
            {t.points.map((point) => (
              <li key={point} style={{ lineHeight: 1.35 }}>
                {point}
              </li>
            ))}
          </ul>
        </aside>

        <form onSubmit={submit} className="admin-login-form" aria-busy={loading}>
          <div className="admin-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <p className="admin-login-note" style={{ margin: 0 }}>
              {lang === "ar" ? "أدخل الرمز لتفعيل جلسة الإدارة." : "Enter the token to start an admin session."}
            </p>

            <button
              type="button"
              className="btn"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              title={t.switchLang}
              aria-label={t.switchLang}
              disabled={loading}
            >
              {lang === "en" ? "AR" : "EN"}
            </button>
          </div>

          <div>
            <label htmlFor="admin-token-input" className="admin-label" style={{ marginBottom: 6, display: "block", fontWeight: 800 }}>
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
                disabled={loading}
                autoFocus
                style={{
                  width: "100%",
                  paddingInlineEnd: 160,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: 6,
                  insetInlineEnd: 6,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setReveal((v) => !v)}
                  disabled={loading}
                  aria-pressed={reveal}
                >
                  {reveal ? t.hide : t.show}
                </button>

                <button type="button" className="btn" onClick={onPasteToken} disabled={loading}>
                  {t.paste}
                </button>

                <button type="button" className="btn" onClick={() => setToken("")} disabled={loading || !token}>
                  {t.clear}
                </button>
              </div>
            </div>
          </div>

          {err ? (
            <div
              role="alert"
              aria-live="polite"
              style={{
                border: "1px solid rgba(180, 35, 24, .25)",
                background: "rgba(255, 242, 242, .9)",
                color: "#b42318",
                borderRadius: 14,
                padding: "10px 12px",
                fontWeight: 700,
              }}
            >
              {t.errorPrefix}
              {err}
            </div>
          ) : null}

          <button className="btn btn-primary" type="submit" disabled={loading || !token.trim()}>
            {loading ? t.signingIn : t.signIn}
          </button>

          <p className="admin-login-note" style={{ marginTop: 4 }}>
            {t.help}
          </p>
        </form>
      </div>
    </div>
  );
}