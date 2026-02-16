"use client";

import { useState } from "react";

type TopicValue =
  | ""
  | "order"
  | "shipping"
  | "product"
  | "wholesale"
  | "collab"
  | "feedback"
  | "other";

type ContactApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function isContactApiResponse(x: unknown): x is ContactApiResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return "ok" in o || "error" in o || "message" in o;
}

export default function ContactForm({ locale }: { locale: "en" | "ar" }) {
  const isAr = locale === "ar";
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const topics: Array<{ value: TopicValue; labelEn: string; labelAr: string }> = [
    { value: "", labelEn: "Select a topic…", labelAr: "اختر التصنيف…" },
    { value: "order", labelEn: "Order / Payment", labelAr: "طلب / دفع" },
    { value: "shipping", labelEn: "Shipping / Delivery", labelAr: "شحن / توصيل" },
    { value: "product", labelEn: "Product / Scent help", labelAr: "منتج / مساعدة اختيار" },
    { value: "wholesale", labelEn: "Wholesale / Corporate", labelAr: "جملة / شركات" },
    { value: "collab", labelEn: "Collaboration", labelAr: "تعاون" },
    { value: "feedback", labelEn: "Feedback", labelAr: "ملاحظات" },
    { value: "other", labelEn: "Other", labelAr: "أخرى" },
  ];

  const whatsappNumber = "962791752686"; // no "+"
  const whatsappText = encodeURIComponent(
    isAr ? "مرحبًا، أحتاج مساعدة من نيفـران." : "Hi NIVRAN, I need help."
  );
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    // IMPORTANT: keep a stable reference; avoids the null reset() issue
    const form = e.currentTarget;

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");

      let data: ContactApiResponse | null = null;
      let text = "";

      if (isJson) {
        const parsed: unknown = await res.json().catch(() => null);
        data = isContactApiResponse(parsed) ? parsed : null;
      } else {
        text = await res.text().catch(() => "");
      }

      if (!res.ok || !data?.ok) {
        setMsg((data?.error || data?.message) || (text ? text.slice(0, 600) : "") || `HTTP ${res.status}`);
        return;
      }

      setMsg(isAr ? "تم الإرسال بنجاح." : "Message sent successfully.");
      form.reset(); // safe: HTMLFormElement.reset() :contentReference[oaicite:1]{index=1}
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : (isAr ? "حدث خطأ في الشبكة." : "Network error."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: ".6rem" }}>
      {/* Quick contact options */}
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <a className="btn" href="mailto:hello@nivran.com">
          {isAr ? "راسلنا عبر البريد" : "Email us"}
        </a>
        <a className="btn" href="tel:+962791752686">
          {isAr ? "اتصل بنا" : "Call us"}
        </a>
        <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
          {isAr ? "واتساب" : "WhatsApp"}
        </a>
      </div>

      <input required className="input" name="name" placeholder={isAr ? "الاسم" : "Name"} />
      <input required className="input" type="email" name="email" placeholder={isAr ? "البريد الإلكتروني" : "Email"} />
      <input className="input" name="phone" placeholder={isAr ? "رقم الهاتف (اختياري)" : "Phone (optional)"} />

      <select required className="input" name="topic" defaultValue="">
        {topics.map((t) => (
          <option key={t.value} value={t.value} disabled={t.value === ""}>
            {isAr ? t.labelAr : t.labelEn}
          </option>
        ))}
      </select>

      <input className="input" name="subject" placeholder={isAr ? "عنوان مختصر (اختياري)" : "Subject (optional)"} />
      <input className="input" name="order_ref" placeholder={isAr ? "رقم الطلب (اختياري)" : "Order # (optional)"} />

      <textarea required className="textarea" name="message" rows={5} placeholder={isAr ? "رسالتك" : "Your message"} />

      <input type="hidden" name="locale" value={locale} />

      <button className="btn primary" disabled={loading}>
        {loading ? "..." : isAr ? "إرسال" : "Send"}
      </button>

      {msg && <p style={{ margin: 0 }}>{msg}</p>}
    </form>
  );
}
