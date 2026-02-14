"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const p = useParams<{ locale?: string }>();
  const locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.ok) {
      setMsg(data?.error || (isAr ? "حدث خطأ" : "Something went wrong"));
      return;
    }
    setMsg(data?.resetUrl ? `${isAr ? "رابط إعادة التعيين:" : "Reset link:"} ${data.resetUrl}` : (isAr ? "إذا كان البريد موجودًا فسيتم إرسال رابط إعادة التعيين." : "If the email exists, a reset link has been sent."));
  }

  return (
    <div style={{ maxWidth: 560, margin: "24px auto" }} className="panel">
      <h1 style={{ marginTop: 0 }}>{isAr ? "نسيت كلمة المرور" : "Forgot password"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <input className="input" name="email" type="email" required placeholder={isAr ? "البريد الإلكتروني" : "Email"} />
        <button className="btn primary">{isAr ? "إرسال رابط إعادة التعيين" : "Send reset link"}</button>
      </form>
      {msg && <p style={{ marginTop: 10, wordBreak: "break-all" }}>{msg}</p>}
    </div>
  );
}
