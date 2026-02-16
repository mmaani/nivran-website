"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { isRecord, readErrorMessage } from "@/lib/http-client";

type ForgotPasswordResponse = { ok?: boolean; error?: string; resetUrl?: string };

export default function ForgotPasswordPage() {
  const p = useParams<{ locale?: string }>();
  const locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      const fd = new FormData(e.currentTarget);
      const email = String(fd.get("email") || "");
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });

      if (!res.ok) {
        setMsg(await readErrorMessage(res, isAr ? "تعذر إرسال طلب الاستعادة." : "Unable to process reset request."));
        return;
      }

      const raw: unknown = await res.json().catch(() => null);
      const data: ForgotPasswordResponse = isRecord(raw) ? (raw as ForgotPasswordResponse) : {};

      if (!data.ok) {
        setMsg(data.error || (isAr ? "تعذر إرسال طلب الاستعادة." : "Unable to process reset request."));
        return;
      }

      setMsg(
        data.resetUrl
          ? `${isAr ? "رابط إعادة التعيين:" : "Reset link:"} ${data.resetUrl}`
          : isAr
            ? "إذا كان البريد موجودًا فسيتم إرسال رابط إعادة التعيين."
            : "If the email exists, a reset link has been sent."
      );
    } catch {
      setMsg(isAr ? "تعذر الاتصال بالخادم. حاول مجددًا." : "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "24px auto" }} className="panel">
      <h1 style={{ marginTop: 0 }}>{isAr ? "نسيت كلمة المرور" : "Forgot password"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }} aria-busy={busy}>
        <input className="input" name="email" type="email" required placeholder={isAr ? "البريد الإلكتروني" : "Email"} />
        <button className="btn primary" disabled={busy}>
          {busy ? (isAr ? "جاري الإرسال…" : "Sending…") : isAr ? "إرسال رابط إعادة التعيين" : "Send reset link"}
        </button>
      </form>
      {msg && <p style={{ marginTop: 10, wordBreak: "break-word" }}>{msg}</p>}
    </div>
  );
}
