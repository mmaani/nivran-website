export default async function FAQPage({
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

      <h1 style={{ marginTop: 14 }}>{isAr ? "الأسئلة الشائعة" : "FAQ"}</h1>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h3>{isAr ? "هل لديكم ادعاءات طبية؟" : "Do you make medical claims?"}</h3>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "لا. نستخدم صياغة آمنة للادعاءات بدون أي ادعاءات طبية أو علاجية."
            : "No. We use claim-safe wording without medical or therapeutic claims."}
        </p>

        <h3>{isAr ? "ما هي رسوم الشحن داخل الأردن؟" : "What is shipping fee in Jordan?"}</h3>
        <p style={{ marginTop: 0 }}>
          {isAr ? "رسوم ثابتة ٣٫٥ دينار أردني داخل الأردن." : "Flat fee 3.5 JOD nationwide in Jordan."}
        </p>

        <h3>{isAr ? "هل المنتج قابل للاشتعال؟" : "Is the product flammable?"}</h3>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "نعم، العطور الكحولية قابلة للاشتعال. يُحفظ بعيدًا عن الحرارة واللهب."
            : "Yes. Alcohol-based perfumes are flammable. Keep away from heat and flame."}
        </p>
      </div>
    </div>
  );
}
