export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  // MVP placeholder content (claim-safe)
  const name = isAr ? "نيفـران — عطر" : "NIVRAN — Eau de Parfum";
  const tagline = isAr ? "ارتدِ الهدوء" : "Wear the calm.";
  const notes = isAr ? "منعش • نظيف • محايد" : "Fresh • Clean • Unisex";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
      <a href={`/${locale}`} style={{ textDecoration: "underline" }}>
        {isAr ? "رجوع" : "Back"}
      </a>

      <h1 style={{ marginBottom: 6, marginTop: 14 }}>{name}</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>{tagline}</p>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          slug: <span style={{ fontFamily: "monospace" }}>{slug}</span>
        </div>

        <h3 style={{ marginTop: 10 }}>{isAr ? "الوصف" : "Description"}</h3>
        <p style={{ marginBottom: 0 }}>
          {isAr
            ? "عطر كحولّي بلمسة نظيفة وبسيطة. مناسب للجنسين ويُستخدم للاسترخاء اليومي دون أي ادعاءات طبية."
            : "An alcohol-based fragrance with a clean, minimalist character. Unisex and everyday-friendly, with claim-safe wording (no medical claims)."}
        </p>

        <h3>{isAr ? "الطابع" : "Profile"}</h3>
        <p>{notes}</p>

        <h3>{isAr ? "تحذيرات" : "Warnings"}</h3>
        <ul>
          <li>{isAr ? "قابل للاشتعال — يُحفظ بعيدًا عن الحرارة واللهب." : "Flammable — keep away from heat and flame."}</li>
          <li>{isAr ? "للاستخدام الخارجي فقط. تجنب ملامسة العينين." : "For external use only. Avoid contact with eyes."}</li>
          <li>{isAr ? "لا تستخدمه على الجلد المتهيج." : "Do not apply to irritated skin."}</li>
        </ul>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href={`/${locale}/checkout`} style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 12, textDecoration: "none" }}>
            {isAr ? "اشترِ الآن" : "Buy now"}
          </a>
          <a href={`/${locale}/faq`} style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 12, textDecoration: "none" }}>
            {isAr ? "الأسئلة الشائعة" : "FAQ"}
          </a>
        </div>
      </div>
    </div>
  );
}
