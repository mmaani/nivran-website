// src/app/admin/inbox/InboxClient.tsx
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

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

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

export default function InboxClient() {
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<InboxResponse>({
    contact: [],
    subscribers: [],
    callbacks: [],
  });

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
      const res = await fetch(
        `/api/admin/inbox?limit=${encodeURIComponent(String(limit))}`,
        { method: "GET", cache: "no-store", credentials: "include" }
      );

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

  // Auto-load once
  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="admin-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>
              <T en="Inbox" ar="الوارد" />
            </h1>
            <p className="admin-muted">
              <T
                en={`Contact: ${stats.contact} • Subscribers: ${stats.subscribers} • PayTabs callbacks: ${stats.callbacks} (valid ${stats.callbacksValid} / invalid ${stats.callbacksInvalid})`}
                ar={`التواصل: ${stats.contact} • المشتركين: ${stats.subscribers} • إشعارات PayTabs: ${stats.callbacks} (صحيح ${stats.callbacksValid} / غير صحيح ${stats.callbacksInvalid})`}
              />
            </p>
          </div>

          <div className="admin-row">
            <input
              type="number"
              min={10}
              max={500}
              value={limit}
              onChange={(e) =>
                setLimit(Math.max(10, Math.min(500, Number(e.target.value || 100))))
              }
              style={{ width: 140 }}
              title="Rows per section"
            />
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? (
                <T en="Loading…" ar="جاري التحميل…" />
              ) : (
                <T en="Refresh" ar="تحديث" />
              )}
            </button>
          </div>
        </div>

        {err ? <p style={{ margin: 0, color: "crimson" }}>{err}</p> : null}
      </div>

      {/* Contact */}
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>
          <T en="Contact submissions" ar="رسائل التواصل" />
        </h2>
        <div className="admin-scroll">
          <table>
            <thead>
              <tr>
                <th><T en="From" ar="المرسل" /></th>
                <th><T en="Message" ar="الرسالة" /></th>
                <th><T en="Meta" ar="بيانات" /></th>
              </tr>
            </thead>
            <tbody>
              {data.contact.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "rgba(0,0,0,.6)" }}>
                    <T en="No contact submissions." ar="لا توجد رسائل." />
                  </td>
                </tr>
              ) : (
                data.contact.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <br />
                      {r.email}
                      <br />
                      {r.phone || "—"}
                    </td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{clamp(r.message, 1200)}</td>
                    <td>
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
      </div>

      {/* Subscribers */}
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>
          <T en="Newsletter subscribers" ar="مشتركو النشرة" />
        </h2>
        <div className="admin-scroll">
          <table>
            <thead>
              <tr>
                <th><T en="Email" ar="البريد" /></th>
                <th><T en="Locale" ar="اللغة" /></th>
                <th><T en="Created" ar="تاريخ" /></th>
              </tr>
            </thead>
            <tbody>
              {data.subscribers.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "rgba(0,0,0,.6)" }}>
                    <T en="No subscribers." ar="لا يوجد مشتركون." />
                  </td>
                </tr>
              ) : (
                data.subscribers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>{s.locale}</td>
                    <td>{fmt(s.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PayTabs callbacks */}
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>
          <T en="PayTabs callbacks" ar="إشعارات PayTabs" />
        </h2>
        <div className="admin-scroll">
          <table>
            <thead>
              <tr>
                <th><T en="ID" ar="المعرف" /></th>
                <th><T en="Cart" ar="السلة" /></th>
                <th><T en="Tran Ref" ar="مرجع العملية" /></th>
                <th><T en="Sig" ar="التوقيع" /></th>
                <th><T en="Created" ar="تاريخ" /></th>
                <th><T en="Payload" ar="البيانات" /></th>
              </tr>
            </thead>
            <tbody>
              {data.callbacks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "rgba(0,0,0,.6)" }}>
                    <T en="No callbacks." ar="لا توجد إشعارات." />
                  </td>
                </tr>
              ) : (
                data.callbacks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.cart_id || "—"}</td>
                    <td>{c.tran_ref || "—"}</td>
                    <td>
                      <span className="badge">
                        {c.signature_valid ? (
                          <T en="Valid" ar="صحيح" />
                        ) : (
                          <T en="Invalid" ar="غير صحيح" />
                        )}
                      </span>
                    </td>
                    <td>{fmt(c.created_at)}</td>
                    <td style={{ whiteSpace: "pre-wrap", maxWidth: 520 }}>
                      {c.raw_preview || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
