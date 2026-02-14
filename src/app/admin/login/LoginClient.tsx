"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
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
    <div className="admin-shell">
      <div className="admin-content">
        <div className="admin-card admin-grid" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 className="admin-h1">
            <T en="Admin Login" ar="تسجيل دخول الإدارة" />
          </h1>

          <p className="admin-muted">
            <T
              en="Enter the admin token to access the dashboard. Token value is set in Vercel as ADMIN_TOKEN."
              ar="أدخل رمز الإدارة للوصول إلى لوحة التحكم. يتم ضبط الرمز في Vercel باسم ADMIN_TOKEN."
            />
          </p>

          <form onSubmit={submit} className="admin-grid">
            <div>
              <div className="admin-label" style={{ marginBottom: 6 }}>
                <T en="ADMIN_TOKEN" ar="رمز الإدارة" />
              </div>
              <input
                className="admin-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ADMIN_TOKEN"
                autoComplete="off"
                spellCheck={false}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading || !token.trim()}>
              {loading ? (
                <T en="Signing in…" ar="جارٍ تسجيل الدخول…" />
              ) : (
                <T en="Sign in" ar="دخول" />
              )}
            </button>

            {err ? (
              <div style={{ color: "crimson" }}>
                <T en="Error: " ar="خطأ: " />
                {err}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
