"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type ResetPasswordResponse = { ok?: boolean; error?: string };

export default function ResetPasswordPage() {
  const p = useParams<{ locale?: string }>();
  const locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const params = useSearchParams();
  const token = String(params.get("token") || "");

  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (password !== confirm) {
      setMsg(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const raw: unknown = await res.json().catch(() => null);
    const data: ResetPasswordResponse = isRecord(raw) ? (raw as ResetPasswordResponse) : {};

    if (!res.ok || !data.ok) {
      setMsg(data.error || (isAr ? "حدث خطأ" : "Something went wrong"));
      return;
    }

    setMsg(isAr ? "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." : "Password changed. You can login now.");

    window.setTimeout(() => {
      window.location.href = `/${locale}/account/login`;
    }, 1200);
  }

  if (!token) {
    return <p>{isAr ? "رابط إعادة التعيين غير صالح" : "Invalid reset link"}</p>;
  }

  return (
    <div style={{ maxWidth: 560, margin: "24px auto" }} className="panel">
      <h1 style={{ marginTop: 0 }}>{isAr ? "إعادة تعيين كلمة المرور" : "Reset password"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <input
          className="input"
          name="password"
          type="password"
          minLength={8}
          required
          placeholder={isAr ? "كلمة المرور الجديدة" : "New password"}
        />
        <input
          className="input"
          name="confirm"
          type="password"
          minLength={8}
          required
          placeholder={isAr ? "تأكيد كلمة المرور" : "Confirm password"}
        />
        <button className="btn primary">{isAr ? "تحديث كلمة المرور" : "Update password"}</button>
      </form>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

