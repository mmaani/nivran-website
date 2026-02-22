"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { isRecord, readErrorMessage } from "@/lib/http-client";

type Locale = "en" | "ar";
type RouteParams = { locale?: string };

type VerifyStartResp = { ok?: boolean; error?: string; retryAfterSec?: number; cooldownSec?: number };
type VerifyConfirmResp = { ok?: boolean; error?: string };

function getLocaleFromParams(p: RouteParams | null): Locale {
  return p?.locale === "ar" ? "ar" : "en";
}

export default function VerifyEmailPage() {
  const params = useParams() as unknown as RouteParams | null;
  const sp = useSearchParams();

  const locale = getLocaleFromParams(params);
  const isAr = locale === "ar";

  const email = sp.get("email") || "";
  const [code, setCode] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState<number>(0);

  // Countdown tick for resend cooldown
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => setCooldownSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [cooldownSec]);

  const canSubmit = useMemo(() => /^[0-9]{4}$/.test(code.trim()), [code]);

  async function resend() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });

      const raw: unknown = await res.json().catch(() => ({}));
      const d: VerifyStartResp = isRecord(raw) ? (raw as VerifyStartResp) : {};

      if (!res.ok || !d.ok) {
        if (res.status === 429 && typeof d.retryAfterSec === "number") {
          setCooldownSec(Math.max(1, Math.floor(d.retryAfterSec)));
          setErr(isAr ? "يرجى الانتظار قبل إعادة الإرسال." : "Please wait before resending.");
          return;
        }
        setErr(d.error || (isAr ? "تعذر إرسال الرمز." : "Could not send code."));
      } else {
        if (typeof d.cooldownSec === "number") setCooldownSec(Math.max(0, Math.floor(d.cooldownSec)));
        setMsg(isAr ? "تم إرسال رمز التحقق." : "Verification code sent.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/verify/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim(), locale }),
      });

      const raw: unknown = await res.json().catch(() => ({}));
      const d: VerifyConfirmResp = isRecord(raw) ? (raw as VerifyConfirmResp) : {};

      if (!res.ok || !d.ok) {
        const fallback = isAr ? "رمز غير صحيح أو منتهي." : "Invalid or expired code.";
        setErr(d.error || (await readErrorMessage(res, fallback)));
        return;
      }

      setMsg(isAr ? "تم تأكيد البريد الإلكتروني." : "Email verified.");
      window.location.href = `/${locale}/account`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {isAr ? "تأكيد البريد الإلكتروني" : "Verify Email"}
      </h1>

      <div className="panel" style={{ display: "grid", gap: 12 }}>
        {email ? (
          <p className="muted" style={{ margin: 0 }}>
            {isAr ? "تم إرسال الرمز إلى:" : "We sent a code to:"} <b>{email}</b>
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {isAr ? "أدخل الرمز الذي وصلك عبر البريد." : "Enter the code we emailed you."}
          </p>
        )}

        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {isAr
            ? 'إذا وصل البريد إلى الرسائل غير الهامة/Spam، اختر "ليس بريدًا غير هام" أو انقله إلى صندوق الوارد لضمان وصول تحديثات الطلبات.'
            : 'If the email is in Junk/Spam, mark it as "Not junk/Not spam" and move it to Inbox so you don’t miss order updates.'}
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <label>
            <span className="muted">{isAr ? "رمز التحقق (4 أرقام)" : "Verification code (4 digits)"}</span>
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={isAr ? "مثال: 0123" : "e.g. 0123"}
              required
            />
          </label>

          {err ? <p style={{ color: "crimson", margin: 0 }}>{err}</p> : null}
          {msg ? <p style={{ color: "green", margin: 0 }}>{msg}</p> : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" disabled={!canSubmit || busy}>
              {busy ? (isAr ? "جارٍ التحقق..." : "Verifying...") : isAr ? "تأكيد" : "Verify"}
            </button>

            <button type="button" className="btn btn-outline" onClick={resend} disabled={busy || cooldownSec > 0}>
              {cooldownSec > 0
                ? isAr
                  ? `إعادة إرسال الرمز (${cooldownSec}s)`
                  : `Resend code (${cooldownSec}s)`
                : isAr
                  ? "إعادة إرسال الرمز"
                  : "Resend code"}
            </button>

            <a className="btn btn-outline" href={`/${locale}/account/login`}>
              {isAr ? "العودة لتسجيل الدخول" : "Back to login"}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
