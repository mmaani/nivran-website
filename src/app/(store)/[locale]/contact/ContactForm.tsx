"use client";

import { useState } from "react";

export default function ContactForm({ locale }: { locale: "en" | "ar" }) {
  const isAr = locale === "ar";
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setMsg(data?.ok ? (isAr ? "تم الإرسال بنجاح." : "Message sent successfully.") : (data?.error || "Error"));
    setLoading(false);
    if (data?.ok) e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: ".6rem" }}>
      <input required className="input" name="name" placeholder={isAr ? "الاسم" : "Name"} />
      <input required className="input" type="email" name="email" placeholder={isAr ? "البريد الإلكتروني" : "Email"} />
      <input className="input" name="phone" placeholder={isAr ? "رقم الهاتف" : "Phone"} />
      <textarea required className="textarea" name="message" rows={5} placeholder={isAr ? "رسالتك" : "Your message"} />
      <input type="hidden" name="locale" value={locale} />
      <button className="btn primary" disabled={loading}>{loading ? "..." : isAr ? "إرسال" : "Send"}</button>
      {msg && <p style={{ margin: 0 }}>{msg}</p>}
    </form>
  );
}
