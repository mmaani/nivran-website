export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const faqs = isAr
    ? [
        ["هل لديكم ادعاءات طبية؟", "لا، نعتمد صياغة آمنة بدون ادعاءات علاجية."],
        ["كم رسوم الشحن؟", "رسوم ثابتة 3.5 دينار داخل الأردن."],
        ["كم مدة التوصيل؟", "عادة خلال 1-3 أيام عمل حسب المنطقة."],
      ]
    : [
        ["Do you make therapeutic claims?", "No. We use claim-safe wording only."],
        ["What is the shipping fee?", "Flat 3.5 JOD across Jordan."],
        ["How long does delivery take?", "Usually 1-3 business days by region."],
      ];

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{isAr ? "الأسئلة الشائعة" : "Frequently asked questions"}</h1>
      <div style={{ display: "grid", gap: ".8rem" }}>
        {faqs.map(([q, a]) => (
          <article key={q} className="panel"><h3 style={{ marginTop: 0 }}>{q}</h3><p style={{ marginBottom: 0 }}>{a}</p></article>
        ))}
      </div>
    </div>
  );
}
