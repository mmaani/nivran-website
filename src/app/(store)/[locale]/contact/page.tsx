export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
      <a href={`/${locale}`} style={{ textDecoration: "underline" }}>
        {isAr ? "رجوع" : "Back"}
      </a>

      <h1 style={{ marginTop: 14 }}>{isAr ? "تواصل معنا" : "Contact"}</h1>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "للاستفسارات داخل الأردن، يرجى التواصل عبر واتساب أو البريد."
            : "For Jordan inquiries, contact us via WhatsApp or email."}
        </p>

        <ul style={{ marginBottom: 0 }}>
          <li>Email: <span style={{ fontFamily: "monospace" }}>hello@nivran.com</span></li>
          <li>WhatsApp: <span style={{ fontFamily: "monospace" }}>+9627XXXXXXXX</span></li>
        </ul>
      </div>
    </div>
  );
}
