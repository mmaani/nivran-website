"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const p = useParams<{ locale?: string }>();
  const locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: String(fd.get("first_name") || ""),
      lastName: String(fd.get("last_name") || ""),
      email: String(fd.get("email") || ""),
      phone: String(fd.get("phone") || ""),
      password: String(fd.get("password") || ""),
      locale,
    };
    const res = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data?.ok) window.location.href = `/${locale}/account`;
    else setMsg(data?.error || "Error");
  }

  return (
    <div style={{ maxWidth: 560, margin: "24px auto" }} className="panel">
      <h1 style={{ marginTop: 0 }}>{isAr ? "إنشاء حساب" : "Create account"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <input className="input" name="first_name" placeholder={isAr ? "الاسم الأول" : "First name"} />
        <input className="input" name="last_name" placeholder={isAr ? "اسم العائلة" : "Last name"} />
        <input className="input" name="email" type="email" required placeholder={isAr ? "البريد الإلكتروني" : "Email"} />
        <input className="input" name="phone" placeholder={isAr ? "رقم الهاتف" : "Phone"} />
        <input className="input" name="password" type="password" required minLength={8} placeholder={isAr ? "كلمة المرور (8 أحرف على الأقل)" : "Password (min 8 chars)"} />
        <button className="btn primary">{isAr ? "تسجيل" : "Sign up"}</button>
      </form>
      {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      <p className="muted">{isAr ? "لديك حساب؟" : "Already have account?"} <a style={{ textDecoration: "underline" }} href={`/${locale}/account/login`}>{isAr ? "دخول" : "Login"}</a></p>
    </div>
  );
}
