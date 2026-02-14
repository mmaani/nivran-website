"use client";

import React, { useEffect, useMemo, useState } from "react";

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

export default function InboxClient() {
  const lang = useAdminLang();

  const t =
    lang === "ar"
      ? {
          title: "الوارد",
          contactStatsLabel: "التواصل",
          subsStatsLabel: "المشتركين",
          cbStatsLabel: "إشعارات PayTabs",
          valid: "صحيح",
          invalid: "غير صحيح",
          rowsTitle: "عدد الصفوف",
          refresh: "تحديث",
          loading: "جاري التحميل…",
          contactTitle: "رسائل التواصل",
          subsTitle: "مشتركو النشرة",
          cbTitle: "إشعارات PayTabs",
          thFrom: "المرسل",
          thMsg: "الرسالة",
          thMeta: "بيانات",
          thEmail: "البريد",
          thLocale: "اللغة",
          thCreated: "تاريخ",
          thId: "المعرف",
          thCart: "السلة",
          thTran: "مرجع العملية",
          thSig: "التوقيع",
          thPayload: "البيانات",
          emptyContact: "لا توجد رسائل.",
          emptySubs: "لا يوجد مشتركون.",
          emptyCb: "لا توجد إشعارات.",
        }
      : {
          title: "Inbox",
          contactStatsLabel: "Contact",
          subsStatsLabel: "Subscribers",
          cbStatsLabel: "PayTabs callbacks",
          valid: "valid",
          invalid: "invalid",
          rowsTitle: "Rows per section",
          refresh: "Refresh",
          loading: "Loading…",
          contactTitle: "Contact submissions",
          subsTitle: "Newsletter subscribers",
          cbTitle: "PayTabs callbacks",
          thFrom: "From",
          thMsg: "Message",
          thMeta: "Meta",
          thEmail: "Email",
          thLocale: "Locale",
          thCreated: "Created",
          thId: "ID",
          thCart: "Cart",
          thTran: "Tran Ref",
          thSig: "Sig",
          thPayload: "Payload",
          emptyContact: "No contact submissions.",
          emptySubs: "No subscribers.",
          emptyCb: "No callbacks.",
        };

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
      const res = await fetch(`/api/admin/inbox?limit=${encodeURIComponent(String(limit))}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
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

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-page" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="admin-card">
        <div className="admin-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 style={{ marginTop: 0 }}>{t.title}</h1>
            <p className="admin-muted">
              {t.contactStatsLabel}: {stats.contact} • {t.subsStatsLabel}: {stats.subscribers} • {t.cbStatsLabel}:{" "}
              {stats.callbacks} ({t.valid} {stats.callbacksValid} / {t.invalid} {stats.callbacksInvalid})
            </p>
          </div>

          <div className="admin-row">
            <input
              className="admin-input"
              type="number"
              min={10}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Math.max(10, Math.min(500, Number(e.target.value || 100))))}
              style={{ width: 140 }}
              title={t.rowsTitle}
            />
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? t.loading : t.refresh}
            </button>
          </div>
        </div>

        {err ? <p style={{ margin: 0, color: "crimson" }}>{err}</p> : null}
      </div>

      {/* Contact */}
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t.contactTitle}</h2>
        <div className="admin-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.thFrom}</th>
                <th>{t.thMsg}</th>
                <th>{t.thMeta}</th>
              </tr>
            </thead>
            <tbody>
              {data.contact.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "rgba(0,0,0,.6)" }}>
                    {t.emptyContact}
                  </td>
                </tr>
              ) : (
                data.contact.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <br />
                      <span className="ltr">{r.email}</span>
                      <br />
                      <span className="ltr">{r.phone || "—"}</span>
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
        <h2 style={{ marginTop: 0 }}>{t.subsTitle}</h2>
        <div className="admin-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.thEmail}</th>
                <th>{t.thLocale}</th>
                <th>{t.thCreated}</th>
              </tr>
            </thead>
            <tbody>
              {data.subscribers.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "rgba(0,0,0,.6)" }}>
                    {t.emptySubs}
                  </td>
                </tr>
              ) : (
                data.subscribers.map((s) => (
                  <tr key={s.id}>
                    <td className="ltr">{s.email}</td>
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
        <h2 style={{ marginTop: 0 }}>{t.cbTitle}</h2>
        <div className="admin-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.thId}</th>
                <th>{t.thCart}</th>
                <th>{t.thTran}</th>
                <th>{t.thSig}</th>
                <th>{t.thCreated}</th>
                <th>{t.thPayload}</th>
              </tr>
            </thead>
            <tbody>
              {data.callbacks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "rgba(0,0,0,.6)" }}>
                    {t.emptyCb}
                  </td>
                </tr>
              ) : (
                data.callbacks.map((c) => (
                  <tr key={c.id}>
                    <td className="ltr">{c.id}</td>
                    <td className="ltr">{c.cart_id || "—"}</td>
                    <td className="ltr">{c.tran_ref || "—"}</td>
                    <td>
                      <span className="badge">{c.signature_valid ? t.valid : t.invalid}</span>
                    </td>
                    <td>{fmt(c.created_at)}</td>
                    <td style={{ whiteSpace: "pre-wrap", maxWidth: 520 }}>{c.raw_preview || "—"}</td>
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
