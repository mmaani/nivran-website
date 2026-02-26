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
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const safeNext = useMemo(() => (nextPath?.startsWith("/") ? nextPath : "/admin"), [nextPath]);
  const isAr = lang === "ar";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const endpoint = mode === "admin" ? "/api/admin/login" : "/api/admin/sales/login";
      const payload = mode === "admin" ? { token: token.trim() } : { email: email.trim(), password, rememberMe };
      const res = await adminFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, isAr ? "فشل تسجيل الدخول" : "Login failed"));
      const data: unknown = await res.json().catch(() => null);
      if (!isRecord(data) || data["ok"] !== true) throw new Error(isAr ? "فشل تسجيل الدخول" : "Login failed");
      const next = mode === "sales" ? "/admin/sales" : safeNext;
      window.location.assign(next);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-card admin-login-card" dir={isAr ? "rtl" : "ltr"}>
      <h1 className="admin-h1">{isAr ? "تسجيل الدخول" : "Sign in"}</h1>
      <div className="admin-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`btn ${mode === "admin" ? "btn-primary" : ""}`} onClick={() => setMode("admin")}>Admin</button>
        <button type="button" className={`btn ${mode === "sales" ? "btn-primary" : ""}`} onClick={() => setMode("sales")}>Sales</button>
        <button type="button" className="btn" onClick={() => setLang(isAr ? "en" : "ar")}>{isAr ? "EN" : "AR"}</button>
      </div>

      <form onSubmit={submit} className="admin-login-form" aria-busy={loading}>
        {mode === "admin" ? (
          <input className="admin-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" required />
        ) : (
          <>
            <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isAr ? "البريد الإلكتروني" : "Staff email"} required />
            <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isAr ? "كلمة المرور" : "Password"} required />
            <label className="admin-row" style={{ gap: 8 }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span>{isAr ? "تذكرني" : "Remember me"}</span>
            </label>
          </>
        )}
        {err ? <p className="admin-error">{err}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? (isAr ? "جارٍ الدخول..." : "Signing in...") : (isAr ? "دخول" : "Sign in")}</button>
      </form>
    </div>
  );
}
