"use client";

import React, { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { readErrorMessage } from "@/lib/http-client";
import { adminFetch, readAdminLangCookie } from "@/app/admin/_components/adminClient";

type Lang = "en" | "ar";
type RoleMode = "admin" | "sales";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function useAdminLang(): [Lang, (next: Lang) => Promise<void>] {
  const [lang, setLang] = useState<Lang>("en");
  const pathname = usePathname();
  React.useEffect(() => setLang(readAdminLangCookie()), []);
  async function updateLang(next: Lang) {
    setLang(next);
    await fetch("/api/admin/lang", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lang: next, next: pathname }),
      cache: "no-store",
    }).catch(() => null);
  }
  return [lang, updateLang];
}

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const [lang, setLang] = useAdminLang();
  const [mode, setMode] = useState<RoleMode>("admin");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const safeNext = useMemo(() => {
    if (!nextPath || !nextPath.startsWith("/")) return "/admin";
    if (nextPath.startsWith("//")) return "/admin";
    return nextPath;
  }, [nextPath]);

  const isAr = lang === "ar";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const endpoint = mode === "admin" ? "/api/admin/login" : "/api/admin/sales/login";
      const payload =
        mode === "admin"
          ? { token: token.trim() }
          : { email: email.trim().toLowerCase(), password, rememberMe };

      const res = await adminFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, isAr ? "فشل تسجيل الدخول" : "Login failed"));
      }

      const data: unknown = await res.json().catch(() => null);
      if (!isRecord(data) || data["ok"] !== true) {
        throw new Error(isAr ? "فشل تسجيل الدخول" : "Login failed");
      }

      const target = mode === "sales" ? "/admin/sales" : safeNext;
      window.location.assign(target);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-card admin-login-card" dir={isAr ? "rtl" : "ltr"}>
      <div className="admin-login-layout">
        <aside className="admin-login-side admin-login-side-lux">
          <p className="admin-muted" style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: ".16em", fontWeight: 900 }}>
            NIVRAN
          </p>
          <h1 className="admin-h1" style={{ color: "#fff", marginBottom: 6 }}>
            {isAr ? "بوابة التحكم الفاخرة" : "Luxury Operations Portal"}
          </h1>
          <p className="admin-muted" style={{ color: "rgba(255,255,255,.82)" }}>
            {isAr
              ? "وصول آمن لإدارة الطلبات والمخزون وخدمة العملاء بمستوى علامة فاخرة."
              : "Secure access for premium order handling, inventory control, and concierge-level customer operations."}
          </p>
          <ul style={{ marginTop: 12 }}>
            <li>{isAr ? "جلسات آمنة وقيود صلاحيات دقيقة" : "Secure sessions and strict role boundaries"}</li>
            <li>{isAr ? "إدارة مبيعات سريعة مع تحديث مخزون فوري" : "Fast sales flow with immediate stock updates"}</li>
            <li>{isAr ? "واجهة ثنائية اللغة للاستخدام اليومي" : "Bilingual interface for daily operations"}</li>
          </ul>
        </aside>

        <form onSubmit={submit} className="admin-login-form" aria-busy={loading}>
          <div className="admin-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>{isAr ? "تسجيل الدخول" : "Sign in"}</h2>
              <p className="admin-muted" style={{ marginTop: 4 }}>
                {isAr ? "اختر نوع الوصول ثم أكمل بيانات الدخول" : "Choose access type, then complete credentials"}
              </p>
            </div>
            <button type="button" className="btn" onClick={() => setLang(isAr ? "en" : "ar")}>
              {isAr ? "EN" : "AR"}
            </button>
          </div>

          <div className="admin-row" style={{ gap: 8 }}>
            <button type="button" className={`btn ${mode === "admin" ? "btn-primary" : ""}`} onClick={() => setMode("admin")}>
              {isAr ? "إدارة" : "Admin"}
            </button>
            <button type="button" className={`btn ${mode === "sales" ? "btn-primary" : ""}`} onClick={() => setMode("sales")}>
              {isAr ? "مبيعات" : "Sales"}
            </button>
          </div>

          {mode === "admin" ? (
            <div className="admin-grid" style={{ gap: 8 }}>
              <label className="admin-muted" style={{ fontWeight: 700 }}>{isAr ? "رمز الإدارة" : "Admin token"}</label>
              <input
                className="admin-input"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ADMIN_TOKEN"
                required
              />
            </div>
          ) : (
            <div className="admin-grid" style={{ gap: 8 }}>
              <label className="admin-muted" style={{ fontWeight: 700 }}>{isAr ? "البريد الإلكتروني" : "Staff email"}</label>
              <input
                className="admin-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@email.com"
                required
              />
              <label className="admin-muted" style={{ fontWeight: 700 }}>{isAr ? "كلمة المرور" : "Password"}</label>
              <div className="admin-row" style={{ gap: 8 }}>
                <input
                  className="admin-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLockOn(false)}
                  placeholder={isAr ? "كلمة المرور" : "Password"}
                  required
                  style={{ flex: 1 }}
                />
                <button className="btn" type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? (isAr ? "إخفاء" : "Hide") : (isAr ? "إظهار" : "Show")}
                </button>
              </div>
              {capsLockOn ? <p className="admin-muted" style={{ color: "#8b5e1a" }}>{isAr ? "تنبيه: زر الأحرف الكبيرة مفعل." : "Warning: Caps Lock is ON."}</p> : null}
              <label className="admin-row" style={{ gap: 8 }}>
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>{isAr ? "تذكرني" : "Remember me"}</span>
              </label>
            </div>
          )}

          {err ? <p className="admin-error">{err}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (isAr ? "جارٍ تسجيل الدخول..." : "Signing in...") : (isAr ? "دخول" : "Sign in")}
          </button>

          <p className="admin-muted" style={{ fontSize: 12 }}>
            {isAr
              ? "إذا كنت موظف مبيعات فسيكون الوصول مقتصرًا على بوابة المبيعات فقط."
              : "Sales staff accounts are restricted to the sales portal only."}
          </p>
        </form>
      </div>
    </div>
  );
}
