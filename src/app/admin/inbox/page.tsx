"use client";

import React, { useEffect, useMemo, useState } from "react";

type ContactRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
  created_at: string;
};

type SubscriberRow = {
  id: number;
  email: string;
  locale: string;
  created_at: string;
};

type CallbackRow = {
  id: number;
  cart_id: string | null;
  tran_ref: string | null;
  signature_valid: boolean;
  created_at: string;
  raw_preview: string | null;
};

type InboxResponse = {
  contact: ContactRow[];
  subscribers: SubscriberRow[];
  callbacks: CallbackRow[];
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function clamp(s: string, n: number) {
  const t = String(s || "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export default function AdminInboxPage() {
  const [token, setToken] = useState("");
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<InboxResponse>({
    contact: [],
    subscribers: [],
    callbacks: [],
  });

  useEffect(() => {
    const saved = window.localStorage.getItem("nivran_admin_token") || "";
    if (saved) setToken(saved);
  }, []);

  const stats = useMemo(() => {
    const valid = data.callbacks.filter((c) => c.signature_valid).length;
    return {
      contact: data.contact.length,
      subscribers: data.subscribers.length,
      callbacks: data.callbacks.length,
      callbacksValid: valid,
      callbacksInvalid: data.callbacks.length - valid,
    };
  }, [data]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      window.localStorage.setItem("nivran_admin_token", token);

      const res = await fetch(`/api/admin/inbox?limit=${encodeURIComponent(String(limit))}`, {
        method: "GET",
        headers: { "x-admin-token": token || "" },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${txt || res.statusText}`);
      }

      const json = (await res.json()) as InboxResponse;
      setData({
        contact: Array.isArray(json.contact) ? json.contact : [],
        subscribers: Array.isArray(json.subscribers) ? json.subscribers : [],
        callbacks: Array.isArray(json.callbacks) ? json.callbacks : [],
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  function clearToken() {
    window.localStorage.removeItem("nivran_admin_token");
    setToken("");
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 1120, margin: "20px auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>NIVRAN Admin — Inbox</h1>
        <a href="/admin/orders" style={{ textDecoration: "underline" }}>
          Orders
        </a>
        <a href="/admin/catalog" style={{ textDecoration: "underline" }}>
          Catalog
        </a>
        <a href="/admin/staff" style={{ textDecoration: "underline" }}>
          Staff
        </a>
      </div>

      <section
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid rgba(0,0,0,.12)",
          borderRadius: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.8 }}>ADMIN_TOKEN</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste admin token"
              style={{
                flex: "1 1 320px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.18)",
                outline: "none",
              }}
            />
            <input
              type="number"
              min={10}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Math.max(10, Math.min(500, Number(e.target.value || 100))))}
              style={{
                width: 130,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.18)",
              }}
              title="Rows per section"
            />
            <button
              onClick={load}
              disabled={loading || !token}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.18)",
                background: loading || !token ? "rgba(0,0,0,.04)" : "white",
                cursor: loading || !token ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading…" : "Load Inbox"}
            </button>
            <button
              onClick={clearToken}
              type="button"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,.18)",
                background: "white",
                cursor: "pointer",
              }}
            >
              Clear Token
            </button>
          </div>

          {err ? (
            <p style={{ margin: 0, color: "crimson" }}>{err}</p>
          ) : (
            <p style={{ margin: 0, opacity: 0.75 }}>
              Contact: {stats.contact} • Subscribers: {stats.subscribers} • PayTabs callbacks:{" "}
              {stats.callbacks} (valid {stats.callbacksValid} / invalid {stats.callbacksInvalid})
            </p>
          )}
        </div>
      </section>

      {/* Contact */}
      <h2 style={{ marginTop: 18, marginBottom: 8 }}>Contact submissions</h2>
      <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,.12)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(0,0,0,.03)" }}>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>From</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Message</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Meta</th>
            </tr>
          </thead>
          <tbody>
            {data.contact.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
                  No contact submissions loaded.
                </td>
              </tr>
            ) : (
              data.contact.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  <td style={{ padding: 10 }}>
                    <strong>{r.name}</strong>
                    <br />
                    {r.email}
                    <br />
                    {r.phone || "—"}
                  </td>
                  <td style={{ padding: 10, whiteSpace: "pre-wrap" }}>{clamp(r.message, 1200)}</td>
                  <td style={{ padding: 10 }}>
                    {r.locale}
                    <br />
                    {fmt(r.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Subscribers */}
      <h2 style={{ marginTop: 18, marginBottom: 8 }}>Newsletter subscribers</h2>
      <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,.12)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(0,0,0,.03)" }}>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Email</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Locale</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.subscribers.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
                  No subscribers loaded.
                </td>
              </tr>
            ) : (
              data.subscribers.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  <td style={{ padding: 10 }}>{s.email}</td>
                  <td style={{ padding: 10 }}>{s.locale}</td>
                  <td style={{ padding: 10 }}>{fmt(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PayTabs callbacks */}
      <h2 style={{ marginTop: 18, marginBottom: 8 }}>PayTabs callbacks</h2>
      <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,.12)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "rgba(0,0,0,.03)" }}>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>ID</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Cart</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Tran Ref</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Sig</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Created</th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" }}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {data.callbacks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                  No callbacks loaded.
                </td>
              </tr>
            ) : (
              data.callbacks.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  <td style={{ padding: 10 }}>{c.id}</td>
                  <td style={{ padding: 10 }}>{c.cart_id || "—"}</td>
                  <td style={{ padding: 10 }}>{c.tran_ref || "—"}</td>
                  <td style={{ padding: 10 }}>{c.signature_valid ? "✅" : "❌"}</td>
                  <td style={{ padding: 10 }}>{fmt(c.created_at)}</td>
                  <td style={{ padding: 10, whiteSpace: "pre-wrap", maxWidth: 520 }}>
                    {c.raw_preview || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
