"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const p = useParams<{ locale?: string }>();
  const locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = { email: String(fd.get("email") || ""), password: String(fd.get("password") || "") };
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data?.ok) window.location.href = `/${locale}/account`;
    else setMsg(data?.error || "Error");
  }

  return (
    <div style={{ maxWidth: 520, margin: "24px auto" }} className="panel">
      <h1 style={{ marginTop: 0 }}>{isAr ? "تسجيل الدخول" : "Login"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <input className="input" name="email" type="email" required placeholder="Email" />
        <input className="input" name="password" type="password" required placeholder={isAr ? "كلمة المرور" : "Password"} />
        <button className="btn primary">{isAr ? "دخول" : "Login"}</button>
      </form>
      {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      <p className="muted">{isAr ? "ليس لديك حساب؟" : "No account?"} <a style={{ textDecoration: "underline" }} href={`/${locale}/account/signup`}>{isAr ? "إنشاء حساب" : "Sign up"}</a></p>
    </div>
  );
}
