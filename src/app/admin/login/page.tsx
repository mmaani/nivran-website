"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin/orders";

  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setErr(null);
  }, [token]);

  async function submit() {
    setErr(null);
    setOk(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setErr(data.error || "Login failed");
      return;
    }
    setOk(true);
    window.location.href = next;
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui", padding: 18 }}>
      <h1 style={{ marginTop: 0 }}>NIVRAN Admin</h1>
      <p style={{ opacity: 0.75 }}>Enter admin token to continue.</p>

      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ADMIN_TOKEN"
        style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
      />

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {ok && <p style={{ color: "green" }}>OK</p>}

      <button
        onClick={submit}
        style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd" }}
      >
        Login
      </button>
    </div>
  );
}
