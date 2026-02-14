"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const safeNext = useMemo(() => {
    // only allow internal redirects
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Login failed");
      router.replace(safeNext);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 18, fontFamily: "system-ui" }}>
      <h1 style={{ margin: "0 0 8px 0" }}>Admin Login</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Enter the admin token to access the dashboard. Token value is set in Vercel as ADMIN_TOKEN.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          autoComplete="off"
          spellCheck={false}
          style={{
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
            fontFamily: "monospace",
          }}
        />

        <button
          type="submit"
          disabled={loading || !token.trim()}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: loading ? "#f6f6f6" : "white",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {err ? <div style={{ color: "crimson" }}>{err}</div> : null}
      </form>
    </div>
  );
}
